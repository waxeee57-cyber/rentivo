<#
  Point Supabase Auth at a real SMTP provider, and lift the email rate limit.

  WHY THIS EXISTS
  ---------------
  The project is on Supabase's built-in SMTP, which is capped at
  rate_limit_email_sent = 2 PER HOUR for the whole project. That is not a
  throttle you notice in testing — two people can sign up in an hour and the
  third gets no confirmation email at all, with no error the user can see and
  nothing in the app to indicate it. On a launch day that is the entire funnel.

  Supabase says plainly that the built-in service is for testing only and gives
  no delivery guarantees. So this is not an optimisation; it is the difference
  between a marketplace that can take signups and one that cannot.

  WHAT YOU NEED FIRST (about 10 minutes, once)
  --------------------------------------------
  1. A Resend account, and domrol.com added as a sending domain.
  2. The three DNS records Resend gives you (SPF, DKIM, and a return-path
     CNAME) added to the domrol.com zone. Do NOT skip this: sending from an
     unverified domain lands in spam, which fails more quietly than not
     sending at all.
  3. An API key from Resend, put in .env as:  RESEND_API_KEY=re_...

  THEN
  ----
      pwsh -File scripts/configure-auth-smtp.ps1

  It reads the Supabase management token from the credential store the Supabase
  CLI already uses, so there is nothing else to log into, and it never prints
  either secret.
#>

$ErrorActionPreference = 'Stop'

$PROJECT_REF = 'xeyfsacbozucxrwlefro'
$SENDER      = 'noreply@domrol.com'   # must be on the domain verified in Resend
$SENDER_NAME = 'Rentivo'
# Resend's SMTP bridge. Port 587 with STARTTLS is what Supabase Auth expects.
$SMTP_HOST   = 'smtp.resend.com'
$SMTP_PORT   = 587
$SMTP_USER   = 'resend'               # Resend's SMTP username is literally this

# ── The Resend key, from .env ───────────────────────────────────────────────
$envPath = Join-Path $PSScriptRoot '..\.env' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $envPath) { throw "No .env found next to the repo root." }
$line = Get-Content $envPath | Where-Object { $_ -match '^RESEND_API_KEY=' } | Select-Object -First 1
if (-not $line) { throw "RESEND_API_KEY is not in .env. Add it (see the header of this script)." }
$resendKey = ($line -split '=', 2)[1].Trim()
if ($resendKey -notmatch '^re_' -or $resendKey.Length -lt 20) {
  throw "RESEND_API_KEY looks like a placeholder rather than a real key."
}

# ── The Supabase management token, from the CLI's own credential store ──────
# go-keyring puts it in Windows Credential Manager as a UTF-8 blob, which is why
# this reads bytes rather than using PtrToStringUni: decoding it as UTF-16 gives
# you half a token and a very confusing "JWT could not be decoded".
$sig = @'
using System; using System.Runtime.InteropServices; using System.Text;
public class SbCred {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL { public uint Flags; public uint Type; public IntPtr TargetName;
    public IntPtr Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName; }
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredReadW(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr buffer);
  public static string ReadUtf8(string target) {
    IntPtr p; if (!CredReadW(target, 1, 0, out p)) return null;
    var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    var b = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, b, 0, (int)c.CredentialBlobSize);
    CredFree(p); return Encoding.UTF8.GetString(b);
  }
}
'@
Add-Type -TypeDefinition $sig -Language CSharp
$token = [SbCred]::ReadUtf8('Supabase CLI:supabase')
if (-not $token) { throw "No Supabase token in the credential store. Run: npx supabase login" }

$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$uri = "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth"

Write-Host "Current:" -ForegroundColor Cyan
$before = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET
$before | Select-Object smtp_host, smtp_sender_name, rate_limit_email_sent, site_url | Format-List

# PATCH semantics: only the fields below change. Nothing else in the auth config
# is touched, which matters because site_url and uri_allow_list were fixed by
# hand and must not be reverted by a config push.
$body = @{
  smtp_host             = $SMTP_HOST
  smtp_port             = $SMTP_PORT
  smtp_user             = $SMTP_USER
  smtp_pass             = $resendKey
  smtp_admin_email      = $SENDER
  smtp_sender_name      = $SENDER_NAME
  # 2/hour is the built-in-SMTP cap. With a real provider this can be a number
  # that a launch does not immediately exceed.
  rate_limit_email_sent = 100
} | ConvertTo-Json

$after = Invoke-RestMethod -Uri $uri -Headers $headers -Method PATCH -Body $body

Write-Host "`nAfter:" -ForegroundColor Green
$after | Select-Object smtp_host, smtp_sender_name, rate_limit_email_sent, site_url | Format-List

Write-Host "`nNow prove it, rather than trusting it: sign up a real address you can" -ForegroundColor Yellow
Write-Host "read, and confirm the email arrives AND that its link lands on" -ForegroundColor Yellow
Write-Host "https://rentivo.domrol.com rather than localhost." -ForegroundColor Yellow
