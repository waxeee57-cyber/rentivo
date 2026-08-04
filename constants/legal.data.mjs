// ─────────────────────────────────────────────────────────────────────────────
// THE legal source of truth. One literal, three renderers.
//
// WHY THIS FILE IS .mjs AND NOT .ts
// The in-app screens and the static web pages under public/legal/ used to be
// written independently. They drifted, and by 2026-08-04 they contradicted each
// other on the single most important field in a privacy policy — who the data
// controller is (the app said "Rentivo SL, Marbella, Spain", the hosted page
// said a Hungarian sole trader). Two hand-maintained copies of a legal document
// is not a documentation problem, it is a compliance defect.
//
// So the text lives HERE, as plain data, and is consumed by exactly two things:
//   • constants/legal.ts   — adds the TypeScript types, re-exports for the app
//   • scripts/build-legal.mjs — emits public/legal/{doc}/index.html
// A build script cannot import a .ts module without a toolchain; the app can
// import a .mjs one (allowJs + Metro both resolve it). Hence plain JS.
//
// RULES FOR EDITING
// 1. en / es / hu must stay STRUCTURALLY IDENTICAL: same doc ids, same section
//    ids, same section count, same order. scripts/build-legal.mjs asserts this
//    and refuses to emit if it drifts.
// 2. Every factual claim must be traceable to code or to a cited statute. No
//    coverage amounts, retention periods, certifications or company names that
//    nothing in this repo can substantiate.
// 3. Operator identity is NEVER hardcoded. Use the {{LEGAL_NAME}},
//    {{SEAT_ADDRESS}}, {{REG_NUMBER}}, {{TAX_NUMBER}} tokens; both renderers
//    substitute them from LEGAL_ENTITY below.
// 4. The platform fee is NEVER written as a literal percentage. Use
//    {{PLATFORM_FEE}}; the app substitutes it from Config.platformCut and the
//    build script from the same env default, so the contract can never quote a
//    fee different from the one actually charged.
// 5. A body[] entry beginning with "· " renders as a list item (a <li> on the
//    web, an indented bullet line in the app). Everything else is a paragraph.
//    HTML tables are flattened into these bullet lines.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Operator identity. These are the only fields a lawyer/accountant must supply
 * before publication, and they appear in exactly one place on purpose.
 *
 * DO NOT invent values. A privacy policy naming the wrong controller — or a
 * placeholder — is not merely incomplete, it is invalid.
 */
export const LEGAL_ENTITY = {
  legalName:   '[TELJES NÉV — TODO: registered full name of the sole trader]',
  seatAddress: '[SZÉKHELY CÍME — TODO: registered seat address]',
  regNumber:   '[EV NYILVÁNTARTÁSI SZÁM — TODO: sole-trader registration number]',
  taxNumber:   '[ADÓSZÁM — TODO: Hungarian tax number]',
}

export const LEGAL = {
  // ══════════════════════════════════════════════════════════════ ENGLISH ═══
  en: {
    privacy: {
      title: 'Privacy Policy',
      updated: '4 August 2026',
      version: '2.0',
      intro: 'Rentivo is a marketplace for renting cars, boats, bikes and holiday homes around the Mediterranean. Renting a vehicle means handing over real documents and real money, so this page states plainly what we collect, why we are allowed to, who else sees it, and how to make us stop.',
      sections: [
        {
          id: 'who-we-are',
          title: 'Who we are',
          body: [
            'Rentivo is operated by a sole trader registered in Hungary. The data controller is:',
            '{{LEGAL_NAME}}, sole trader (egyéni vállalkozó), {{SEAT_ADDRESS}}, Hungary. Registration number: {{REG_NUMBER}}. Tax number: {{TAX_NUMBER}}. Email: privacy@rentivo.app',
            'Rentivo connects renters with independent rental operators and private hosts. When you book, the operator is a separate controller for the rental contract itself; we are the controller for your account, the booking record and the payment.',
          ],
        },
        {
          id: 'what-we-collect',
          title: 'What we collect and why',
          body: [
            'We do not collect data speculatively. Each category below exists because a specific part of the service cannot work without it.',
            '· Name, email, phone — create your account, confirm bookings, let the operator reach you — Legal basis: performance of a contract.',
            '· Card details — take payment and secure a deposit. Handled by Stripe; we never see or store your card number — Legal basis: performance of a contract.',
            '· Driving licence and ID document details — confirm you may legally rent the vehicle; prevent fraud — Legal basis: contract and legal obligation.',
            '· Approximate location — show vehicles near you on the map — Legal basis: your consent; you can refuse and still use the app.',
            '· Vehicle condition photos — evidence of the vehicle state at pickup and return, so a deposit dispute has facts in it — Legal basis: contract, and our legitimate interest in resolving disputes fairly.',
            '· Messages with the operator — deliver your messages; translate them if you and the operator use different languages — Legal basis: performance of a contract.',
            '· Booking and invoice records — accounting and tax — Legal basis: legal obligation.',
            '· Push notification token — tell you when a booking is confirmed or a vehicle is ready — Legal basis: your consent.',
            '· Crash and error diagnostics — find and fix faults — Legal basis: our legitimate interest in a working app.',
          ],
        },
        {
          id: 'identity-verification',
          title: 'Identity verification',
          body: [
            'Verifying who you are involves a photo of your ID document and a selfie. Facial data is biometric data — a special category under Article 9 GDPR — so we ask for your explicit consent before the check begins. If you do not consent, you cannot complete a rental that requires verification, but nothing else in the app is affected.',
            'The check is run by our verification provider, Didit. The document image and the facial scan are processed by Didit and are not stored on Rentivo systems. What we receive and keep is only the result:',
            '· document type, issuing country, document number and expiry date;',
            '· the name and date of birth printed on the document;',
            '· a numeric face-match score and a pass/fail liveness result.',
            'We keep this so we do not have to ask you to verify again, and so we can show an operator that you are eligible to rent.',
          ],
        },
        {
          id: 'processors',
          title: 'Who else processes your data',
          body: [
            'These are our processors. Each is bound by a data processing agreement and may only act on our instructions.',
            '· Supabase — database, sign-in, file storage — EU (Ireland).',
            '· Stripe Payments Europe — payments, deposits, operator payouts — EU (Ireland).',
            '· Didit — identity and document verification — EU.',
            '· Anthropic — AI assistant, message translation, damage-photo analysis, price suggestions — USA, under SCCs.',
            '· Resend — transactional email — USA, under SCCs.',
            '· Expo — push notifications — USA, under SCCs.',
            '· Sentry — crash and error monitoring — USA, under SCCs.',
            '· CARTO / OpenStreetMap — map tiles; receives your IP address — EU / global.',
            'Where a provider is outside the European Economic Area, the transfer is covered by the European Commission Standard Contractual Clauses. We do not sell your personal data, and we do not share it for advertising.',
          ],
        },
        {
          id: 'where-stored',
          title: 'Where your data is stored',
          body: [
            'Your account, bookings, messages and photos are stored in the European Union (Ireland). Payment data stays with Stripe in the EU. The exceptions are the US providers listed above, which receive only the specific data they need for their function.',
          ],
        },
        {
          id: 'retention',
          title: 'How long we keep it',
          body: [
            '· Account data — while your account exists. Delete your account in the app and we erase it within 30 days, apart from what the law requires us to keep.',
            '· Bookings and invoices — for as long as accounting law requires. Under Hungarian law (Act C of 2000 on Accounting, § 169) accounting records must be kept for eight years.',
            '· Vehicle condition photos — 12 months after the rental ends, so a late damage claim can still be settled on evidence.',
            '· Identity verification results — until the document expires or you delete your account.',
            '· Crash diagnostics — 90 days.',
          ],
        },
        {
          id: 'your-rights',
          title: 'Your rights',
          body: [
            'Under GDPR you may ask us to:',
            '· give you a copy of the personal data we hold about you;',
            '· correct anything inaccurate;',
            '· erase your data — the app has a Delete Account function that starts this immediately;',
            '· restrict, or object to, processing based on legitimate interest;',
            '· port your data to another service in a machine-readable format;',
            '· withdraw consent at any time — for location, notifications or biometric verification — without affecting what was lawful beforehand.',
            'Write to privacy@rentivo.app. We answer within one month.',
            'If you think we have got it wrong, you can complain to the Hungarian supervisory authority — NAIH (Nemzeti Adatvédelmi és Információszabadság Hatóság), 1055 Budapest, Falk Miksa utca 9–11, ugyfelszolgalat@naih.hu, +36 1 391 1400 — or to the data protection authority of the EU country where you live.',
          ],
        },
        {
          id: 'automated-decisions',
          title: 'Automated decisions and AI',
          body: [
            'Identity verification is partly automated. AI is also used to draft assistant replies, translate messages between you and an operator, suggest prices to operators, and flag possible damage in inspection photos.',
            'No decision with legal or similarly significant effect on you is made by a machine alone. In particular, an AI damage flag is a suggestion to the operator — a person must review it before any charge is made against your deposit, and you can contest any charge through the dispute flow in the app. You may always ask for a human review of an automated outcome.',
          ],
        },
        {
          id: 'security',
          title: 'Security',
          body: [
            'Data is encrypted in transit (TLS) and at rest. Access to production data is restricted and logged. Database access is governed row by row, so the records of one user are not reachable from the session of another. Card numbers never touch our servers — Stripe collects them directly.',
            'If a breach ever puts your rights at risk, we notify the supervisory authority within 72 hours and tell you without undue delay.',
          ],
        },
        {
          id: 'children',
          title: 'Children',
          body: [
            'Rentivo is not intended for anyone under 18, and renting a vehicle requires a valid driving licence. We do not knowingly collect data from children. If you believe a child has given us data, write to us and we will delete it.',
          ],
        },
        {
          id: 'changes',
          title: 'Changes',
          body: [
            'If we change this policy we update the date at the top and raise the version. For changes that materially affect your rights we notify you in the app or by email before they take effect.',
          ],
        },
        {
          id: 'contact',
          title: 'Contact',
          body: [
            '{{LEGAL_NAME}}, sole trader · {{SEAT_ADDRESS}}, Hungary',
            'Privacy enquiries: privacy@rentivo.app',
          ],
        },
      ],
    },
    terms: {
      title: 'Terms of Service',
      updated: '4 August 2026',
      version: '2.0',
      intro: 'Please read these Terms carefully before using Rentivo. By using the app you agree to be bound by them.',
      sections: [
        {
          id: 'service',
          title: 'Service description',
          body: [
            'Rentivo is a peer-to-peer rental marketplace connecting vehicle and equipment owners (“Operators”) with renters (“Consumers”). Rentivo acts as an intermediary platform and is not a party to the rental agreement between an Operator and a Consumer.',
          ],
        },
        {
          id: 'obligations',
          title: 'User obligations',
          body: [
            'You must be at least 18 years old to use Rentivo, and you must hold a valid driving licence for any vehicle that requires one.',
            'You agree to provide accurate information, keep your account secure, use what you rent responsibly and in accordance with local law, and return it in the condition in which you received it.',
          ],
        },
        {
          id: 'payments',
          title: 'Payments and platform fee',
          body: [
            'All payments are processed by Stripe. Rentivo charges a platform fee of {{PLATFORM_FEE}} on each transaction. The fee shown in the price breakdown at checkout is the fee that is charged.',
            'Where a booking requires a security deposit, no deposit amount is taken up front. Instead your card is saved with Stripe, with your authorisation, so that a deposit charge can be made later if damage is assessed. If no damage is reported, nothing is charged.',
          ],
        },
        {
          id: 'cancellation',
          title: 'Cancellation',
          body: [
            'Each listing has its own cancellation policy (Flexible, Moderate or Strict). The policy that applies is shown on the listing and again at checkout. The Rentivo platform fee is non-refundable in all cases.',
          ],
        },
        {
          id: 'damage-waiver',
          title: 'Damage waiver and liability',
          body: [
            'Rentivo is not an insurer and does not distribute insurance. Third-party liability for a rented vehicle is covered by the compulsory motor insurance of that vehicle, which the Operator is legally required to hold — not by Rentivo.',
            'Rentivo separately offers an optional paid damage waiver. This is a contractual waiver, not an insurance product, and no monetary coverage ceiling is promised because no policy backs one.',
            'Where a paid waiver is taken, the security deposit is set to €0 and Rentivo reduces or removes your own liability for damage to the rented item, up to the deposit amount that would otherwise have applied. Without a paid waiver the full security deposit applies and you remain liable for damage.',
            'Rentivo is not liable for indirect or consequential damages.',
          ],
        },
        {
          id: 'damage-disputes',
          title: 'Damage and disputes',
          body: [
            'Damage must be reported at pickup or at return using the in-app inspection tool, which records photographs of the condition of the item.',
            'Disputes are handled first between the Consumer and the Operator. Rentivo may mediate but does not guarantee an outcome. False damage claims may lead to account suspension.',
          ],
        },
        {
          id: 'governing-law',
          title: 'Governing law',
          body: [
            'Rentivo is operated by a sole trader registered in Hungary. These Terms are governed by Hungarian law, and the Hungarian courts have jurisdiction.',
            'If you are a consumer resident in the European Union, this does not deprive you of the protection of the mandatory consumer-protection rules of your country of residence, and you may also bring proceedings before the courts of that country.',
          ],
        },
      ],
    },
    cookies: {
      title: 'Cookie and Storage Policy',
      updated: '4 August 2026',
      version: '2.0',
      intro: 'Rentivo is a native mobile app, not a website, so it sets no browser cookies. It does keep a small amount of data in the app storage on your device, and it uses a small number of identifiers. This page describes those, because they raise the same questions cookies do.',
      sections: [
        {
          id: 'not-a-browser',
          title: 'Why this is not a cookie policy',
          body: [
            'Cookies are a browser mechanism. The Rentivo app does not run in a browser and does not use them. The equivalent in a mobile app is local key-value storage on the device, plus identifiers issued by the operating system and by our push provider — all listed below.',
            'The Rentivo web pages, including this one, set no cookies and run no advertising or analytics scripts. They do load a web font from Google Fonts, which receives your IP address as part of that request.',
          ],
        },
        {
          id: 'essential-storage',
          title: 'Essential storage',
          body: [
            'These entries are required for the app to work and cannot be switched off. They stay on your device until you clear the app data or uninstall it, and they are not transmitted anywhere.',
            '· Sign-in session — your authentication session is stored on the device so that you stay signed in between launches.',
            '· Consent record (gdpr_accepted) — whether you have acknowledged the privacy notice, so the consent screen is not shown on every launch.',
            '· Language choice (user_language) — so the app opens in the language you picked.',
            '· Onboarding and setup flags (onboarding_seen, onboarding_complete, operator_setup_complete, host_setup_complete, coachmarks) — so introductory screens and coach marks are shown once rather than every time.',
            '· Phone number awaiting verification (pending_otp_phone) — held only between requesting a sign-in code and entering it.',
          ],
        },
        {
          id: 'convenience-storage',
          title: 'Convenience storage',
          body: [
            'These entries only make the app pleasanter to use. They stay on the device and are never uploaded.',
            '· Recent searches (rentivo_search_history) — your last five searches, so they can be offered to you again. Clearing them removes them from the device.',
            '· Last-opened timestamp (rentivo_last_opened) — used only to show a welcome-back message if you have been away for a while.',
          ],
        },
        {
          id: 'identifiers',
          title: 'Identifiers and data that leaves the device',
          body: [
            '· Push notification token — issued by the Expo push service when you allow notifications, and stored against your account so that booking updates can reach your device. Turning push off in Profile then Privacy Settings clears the stored token.',
            '· Approximate location — requested only when you use the map, and only if you grant the permission. Map tiles are fetched from CARTO / OpenStreetMap, which receives your IP address.',
            '· Crash and error diagnostics — Sentry receives error reports and a sample of performance traces so that faults can be found and fixed.',
          ],
        },
        {
          id: 'no-advertising',
          title: 'Analytics and marketing',
          body: [
            'Rentivo contains no advertising SDK, no cross-app tracking and no advertising identifier. It also contains no third-party product-analytics SDK: the only usage data that leaves the app is the error and performance reporting described above.',
            'Marketing preferences — whether you want offers by email or by push — are recorded against your account rather than in device storage, and are off unless you turn them on.',
          ],
        },
        {
          id: 'manage',
          title: 'How to manage this',
          body: [
            '· Marketing and analytics consent — Profile, then Privacy Settings. Changes are recorded against your account and take effect immediately.',
            '· Location and notification permissions — the system settings for Rentivo on your device.',
            '· Everything stored on the device — uninstalling the app removes it.',
            '· Your account and its server-side record — Profile, then Privacy Settings, then Delete Account. Erasure is subject to the retention periods set out in the Privacy Policy.',
          ],
        },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════ ESPAÑOL ═══
  es: {
    privacy: {
      title: 'Política de Privacidad',
      updated: '4 de agosto de 2026',
      version: '2.0',
      intro: 'Rentivo es un marketplace para alquilar coches, barcos, bicicletas y casas de vacaciones por el Mediterráneo. Alquilar un vehículo implica entregar documentos reales y dinero real, así que esta página explica con claridad qué recogemos, con qué base legal, quién más lo ve y cómo pedirnos que dejemos de hacerlo.',
      sections: [
        {
          id: 'who-we-are',
          title: 'Quiénes somos',
          body: [
            'Rentivo lo opera un trabajador autónomo registrado en Hungría. El responsable del tratamiento es:',
            '{{LEGAL_NAME}}, autónomo (egyéni vállalkozó), {{SEAT_ADDRESS}}, Hungría. Número de registro: {{REG_NUMBER}}. NIF: {{TAX_NUMBER}}. Email: privacy@rentivo.app',
            'Rentivo conecta a inquilinos con operadores de alquiler independientes y anfitriones particulares. Al reservar, el operador es responsable del contrato de alquiler en sí; nosotros lo somos de tu cuenta, del registro de la reserva y del pago.',
          ],
        },
        {
          id: 'what-we-collect',
          title: 'Qué recogemos y por qué',
          body: [
            'No recogemos datos por si acaso. Cada categoría existe porque una parte concreta del servicio no funciona sin ella.',
            '· Nombre, email, teléfono — crear tu cuenta, confirmar reservas y que el operador pueda contactarte — Base legal: ejecución de un contrato.',
            '· Datos de tarjeta — cobrar y asegurar la fianza. Los gestiona Stripe; nunca vemos ni almacenamos tu número de tarjeta — Base legal: ejecución de un contrato.',
            '· Datos del carnet de conducir y del documento de identidad — confirmar que puedes alquilar legalmente y prevenir el fraude — Base legal: contrato y obligación legal.',
            '· Ubicación aproximada — mostrarte vehículos cercanos en el mapa — Base legal: tu consentimiento; puedes negarlo y seguir usando la app.',
            '· Fotos del estado del vehículo — prueba del estado en la entrega y la devolución, para que una disputa de fianza se resuelva con hechos — Base legal: contrato e interés legítimo en resolver disputas con equidad.',
            '· Mensajes con el operador — entregar tus mensajes y traducirlos si habláis idiomas distintos — Base legal: ejecución de un contrato.',
            '· Reservas y facturas — contabilidad e impuestos — Base legal: obligación legal.',
            '· Token de notificaciones — avisarte cuando se confirma una reserva o el vehículo está listo — Base legal: tu consentimiento.',
            '· Diagnósticos de errores — detectar y corregir fallos — Base legal: interés legítimo en que la app funcione.',
          ],
        },
        {
          id: 'identity-verification',
          title: 'Verificación de identidad',
          body: [
            'Verificar tu identidad requiere una foto de tu documento y un selfie. Los datos faciales son datos biométricos, categoría especial del artículo 9 del RGPD, por lo que pedimos tu consentimiento explícito antes de iniciar la comprobación. Si no lo das, no podrás completar un alquiler que exija verificación, pero nada más en la app se ve afectado.',
            'La comprobación la realiza nuestro proveedor de verificación, Didit. La imagen del documento y el escaneo facial los trata Didit y no se almacenan en los sistemas de Rentivo. Lo que recibimos y conservamos es únicamente el resultado:',
            '· tipo de documento, país emisor, número y fecha de caducidad;',
            '· el nombre y la fecha de nacimiento impresos en el documento;',
            '· una puntuación numérica de coincidencia facial y un resultado de prueba de vida.',
            'Lo conservamos para no pedirte que te verifiques de nuevo y para poder acreditar ante un operador que puedes alquilar.',
          ],
        },
        {
          id: 'processors',
          title: 'Quién más trata tus datos',
          body: [
            'Estos son nuestros encargados del tratamiento. Cada uno está vinculado por un contrato de tratamiento y solo puede actuar siguiendo nuestras instrucciones.',
            '· Supabase — base de datos, acceso, almacenamiento de archivos — UE (Irlanda).',
            '· Stripe Payments Europe — pagos, fianzas y liquidaciones a operadores — UE (Irlanda).',
            '· Didit — verificación de identidad y documentos — UE.',
            '· Anthropic — asistente IA, traducción de mensajes, análisis de fotos de daños, sugerencias de precio — EE. UU., con CCT.',
            '· Resend — correo transaccional — EE. UU., con CCT.',
            '· Expo — notificaciones push — EE. UU., con CCT.',
            '· Sentry — monitorización de errores — EE. UU., con CCT.',
            '· CARTO / OpenStreetMap — mapas; recibe tu dirección IP — UE / global.',
            'Cuando un proveedor está fuera del Espacio Económico Europeo, la transferencia se ampara en las Cláusulas Contractuales Tipo de la Comisión Europea. No vendemos tus datos personales ni los compartimos con fines publicitarios.',
          ],
        },
        {
          id: 'where-stored',
          title: 'Dónde se almacenan',
          body: [
            'Tu cuenta, reservas, mensajes y fotos se almacenan en la Unión Europea (Irlanda). Los datos de pago permanecen en Stripe dentro de la UE. Las excepciones son los proveedores estadounidenses citados arriba, que reciben solo los datos concretos que necesitan.',
          ],
        },
        {
          id: 'retention',
          title: 'Cuánto tiempo los conservamos',
          body: [
            '· Datos de la cuenta — mientras exista tu cuenta. Si la eliminas desde la app, los borramos en 30 días, salvo lo que la ley nos obligue a conservar.',
            '· Reservas y facturas — el plazo que exija la normativa contable. Conforme a la ley húngara (Ley C de 2000 de Contabilidad, § 169) los registros contables se conservan ocho años.',
            '· Fotos del estado del vehículo — 12 meses tras finalizar el alquiler, para poder resolver con pruebas una reclamación tardía.',
            '· Resultados de verificación — hasta que caduque el documento o elimines tu cuenta.',
            '· Diagnósticos de errores — 90 días.',
          ],
        },
        {
          id: 'your-rights',
          title: 'Tus derechos',
          body: [
            'Conforme al RGPD puedes pedirnos:',
            '· una copia de los datos personales que tenemos sobre ti;',
            '· rectificar lo que sea inexacto;',
            '· suprimir tus datos — la app incluye una función de eliminar cuenta que lo inicia de inmediato;',
            '· limitar el tratamiento u oponerte al basado en interés legítimo;',
            '· portar tus datos a otro servicio en formato legible por máquina;',
            '· retirar el consentimiento en cualquier momento, para ubicación, notificaciones o verificación biométrica, sin afectar a la licitud del tratamiento previo.',
            'Escribe a privacy@rentivo.app. Respondemos en el plazo de un mes.',
            'Si consideras que no lo hemos hecho bien, puedes reclamar ante la autoridad de control húngara — NAIH, 1055 Budapest, Falk Miksa utca 9–11, ugyfelszolgalat@naih.hu, +36 1 391 1400 — o ante la autoridad de protección de datos del país de la UE en el que residas, por ejemplo la AEPD en España.',
          ],
        },
        {
          id: 'automated-decisions',
          title: 'Decisiones automatizadas e IA',
          body: [
            'La verificación de identidad está parcialmente automatizada. También usamos IA para redactar respuestas del asistente, traducir mensajes entre tú y el operador, sugerir precios a los operadores y señalar posibles daños en las fotos de inspección.',
            'Ninguna decisión con efectos jurídicos o similarmente significativos se toma únicamente por medios automatizados. En concreto, una señal de daño generada por IA es una sugerencia al operador: una persona debe revisarla antes de cualquier cargo contra tu fianza, y puedes impugnar cualquier cargo mediante el flujo de disputas de la app. Siempre puedes solicitar la revisión humana de un resultado automatizado.',
          ],
        },
        {
          id: 'security',
          title: 'Seguridad',
          body: [
            'Los datos se cifran en tránsito (TLS) y en reposo. El acceso a datos de producción está restringido y registrado. El acceso a la base de datos se controla fila a fila, de modo que los registros de un usuario no son accesibles desde la sesión de otro. Los números de tarjeta nunca pasan por nuestros servidores: los recoge Stripe directamente.',
            'Si una brecha llegara a poner en riesgo tus derechos, lo notificamos a la autoridad de control en 72 horas y te informamos sin dilación indebida.',
          ],
        },
        {
          id: 'children',
          title: 'Menores',
          body: [
            'Rentivo no está dirigido a menores de 18 años, y alquilar un vehículo exige un carnet de conducir válido. No recogemos datos de menores de forma consciente. Si crees que un menor nos ha facilitado datos, escríbenos y los eliminaremos.',
          ],
        },
        {
          id: 'changes',
          title: 'Cambios',
          body: [
            'Si modificamos esta política actualizamos la fecha superior y subimos la versión. Cuando un cambio afecte materialmente a tus derechos, te avisamos en la app o por correo antes de que entre en vigor.',
          ],
        },
        {
          id: 'contact',
          title: 'Contacto',
          body: [
            '{{LEGAL_NAME}}, autónomo · {{SEAT_ADDRESS}}, Hungría',
            'Consultas de privacidad: privacy@rentivo.app',
          ],
        },
      ],
    },
    terms: {
      title: 'Términos del Servicio',
      updated: '4 de agosto de 2026',
      version: '2.0',
      intro: 'Lee estos Términos con atención antes de usar Rentivo. Al usar la app aceptas quedar vinculado por ellos.',
      sections: [
        {
          id: 'service',
          title: 'Descripción del servicio',
          body: [
            'Rentivo es un marketplace de alquiler entre particulares que conecta a propietarios de vehículos y equipos («Operadores») con inquilinos («Consumidores»). Rentivo actúa como plataforma intermediaria y no es parte del contrato de alquiler entre un Operador y un Consumidor.',
          ],
        },
        {
          id: 'obligations',
          title: 'Obligaciones del usuario',
          body: [
            'Debes tener al menos 18 años para usar Rentivo y disponer de un carnet de conducir válido para cualquier vehículo que lo requiera.',
            'Te comprometes a facilitar información veraz, mantener la seguridad de tu cuenta, usar lo que alquilas de forma responsable y conforme a la ley local, y devolverlo en el estado en que lo recibiste.',
          ],
        },
        {
          id: 'payments',
          title: 'Pagos y comisión de la plataforma',
          body: [
            'Todos los pagos los procesa Stripe. Rentivo cobra una comisión de plataforma del {{PLATFORM_FEE}} en cada transacción. La comisión que aparece en el desglose de precio al pagar es la que se cobra.',
            'Cuando una reserva exige fianza, no se cobra ningún importe por adelantado. En su lugar, tu tarjeta queda guardada en Stripe con tu autorización, para poder cargar la fianza más adelante si se determinan daños. Si no se comunica ningún daño, no se cobra nada.',
          ],
        },
        {
          id: 'cancellation',
          title: 'Cancelación',
          body: [
            'Cada anuncio tiene su propia política de cancelación (Flexible, Moderada o Estricta). La política aplicable se muestra en el anuncio y de nuevo al pagar. La comisión de plataforma de Rentivo no es reembolsable en ningún caso.',
          ],
        },
        {
          id: 'damage-waiver',
          title: 'Exención de daños y responsabilidad',
          body: [
            'Rentivo no es una aseguradora y no distribuye seguros. La responsabilidad civil frente a terceros por un vehículo alquilado la cubre el seguro obligatorio del propio vehículo, que el Operador está legalmente obligado a contratar, y no Rentivo.',
            'Rentivo ofrece por separado una exención de daños opcional de pago. Es una exención contractual, no un producto de seguro, y no se promete ningún límite monetario de cobertura porque ninguna póliza lo respalda.',
            'Cuando se contrata una exención de pago, la fianza queda en €0 y Rentivo reduce o elimina tu responsabilidad por daños al bien alquilado, hasta el importe de la fianza que se habría aplicado. Sin exención de pago se aplica la fianza completa y sigues siendo responsable de los daños.',
            'Rentivo no responde de daños indirectos o consecuenciales.',
          ],
        },
        {
          id: 'damage-disputes',
          title: 'Daños y disputas',
          body: [
            'Los daños deben comunicarse en la entrega o en la devolución mediante la herramienta de inspección de la app, que registra fotografías del estado del bien.',
            'Las disputas se resuelven primero entre el Consumidor y el Operador. Rentivo puede mediar, pero no garantiza un resultado. Las reclamaciones de daños falsas pueden conllevar la suspensión de la cuenta.',
          ],
        },
        {
          id: 'governing-law',
          title: 'Ley aplicable',
          body: [
            'Rentivo lo opera un trabajador autónomo registrado en Hungría. Estos Términos se rigen por la ley húngara y los tribunales húngaros son competentes.',
            'Si eres consumidor con residencia en la Unión Europea, esto no te priva de la protección de las normas imperativas de consumo de tu país de residencia, y también puedes acudir a los tribunales de ese país.',
          ],
        },
      ],
    },
    cookies: {
      title: 'Política de Cookies y Almacenamiento',
      updated: '4 de agosto de 2026',
      version: '2.0',
      intro: 'Rentivo es una app móvil nativa, no una web, por lo que no instala cookies de navegador. Sí guarda una pequeña cantidad de datos en el almacenamiento de la app en tu dispositivo y usa unos pocos identificadores. Esta página los describe, porque plantean las mismas preguntas que las cookies.',
      sections: [
        {
          id: 'not-a-browser',
          title: 'Por qué esto no es una política de cookies',
          body: [
            'Las cookies son un mecanismo del navegador. La app de Rentivo no se ejecuta en un navegador y no las usa. El equivalente en una app móvil es el almacenamiento local clave-valor del dispositivo, más los identificadores que emiten el sistema operativo y nuestro proveedor de notificaciones, todos ellos listados abajo.',
            'Las páginas web de Rentivo, incluida esta, no instalan cookies ni ejecutan scripts publicitarios o de analítica. Sí cargan una fuente web desde Google Fonts, que recibe tu dirección IP como parte de esa petición.',
          ],
        },
        {
          id: 'essential-storage',
          title: 'Almacenamiento esencial',
          body: [
            'Estas entradas son necesarias para que la app funcione y no pueden desactivarse. Permanecen en tu dispositivo hasta que borres los datos de la app o la desinstales, y no se transmiten a ninguna parte.',
            '· Sesión de acceso — tu sesión de autenticación se guarda en el dispositivo para que sigas dentro entre aperturas.',
            '· Registro de consentimiento (gdpr_accepted) — si has aceptado el aviso de privacidad, para no mostrarte la pantalla de consentimiento en cada apertura.',
            '· Idioma elegido (user_language) — para que la app se abra en el idioma que escogiste.',
            '· Indicadores de bienvenida y configuración (onboarding_seen, onboarding_complete, operator_setup_complete, host_setup_complete, coachmarks) — para mostrar las pantallas introductorias y las guías una sola vez.',
            '· Teléfono pendiente de verificar (pending_otp_phone) — se conserva solo entre la solicitud del código de acceso y su introducción.',
          ],
        },
        {
          id: 'convenience-storage',
          title: 'Almacenamiento de conveniencia',
          body: [
            'Estas entradas solo hacen la app más cómoda. Permanecen en el dispositivo y nunca se suben.',
            '· Búsquedas recientes (rentivo_search_history) — tus últimas cinco búsquedas, para poder ofrecértelas de nuevo. Al borrarlas desaparecen del dispositivo.',
            '· Marca de la última apertura (rentivo_last_opened) — se usa solo para mostrar un mensaje de bienvenida si llevabas tiempo sin entrar.',
          ],
        },
        {
          id: 'identifiers',
          title: 'Identificadores y datos que salen del dispositivo',
          body: [
            '· Token de notificaciones push — lo emite el servicio push de Expo cuando permites las notificaciones y se guarda asociado a tu cuenta para que las novedades de las reservas lleguen a tu dispositivo. Desactivar el push en Perfil y luego Configuración de privacidad borra el token guardado.',
            '· Ubicación aproximada — se solicita solo cuando usas el mapa y solo si concedes el permiso. Los mapas se descargan de CARTO / OpenStreetMap, que recibe tu dirección IP.',
            '· Diagnósticos de errores — Sentry recibe informes de error y una muestra de trazas de rendimiento para poder detectar y corregir fallos.',
          ],
        },
        {
          id: 'no-advertising',
          title: 'Analítica y marketing',
          body: [
            'Rentivo no incorpora ningún SDK publicitario, ningún seguimiento entre apps ni identificador de publicidad. Tampoco incorpora un SDK de analítica de producto de terceros: los únicos datos de uso que salen de la app son los informes de error y rendimiento descritos arriba.',
            'Las preferencias de marketing — si quieres ofertas por correo o por push — se guardan asociadas a tu cuenta y no en el almacenamiento del dispositivo, y están desactivadas salvo que las actives.',
          ],
        },
        {
          id: 'manage',
          title: 'Cómo gestionarlo',
          body: [
            '· Consentimiento de marketing y analítica — Perfil y luego Configuración de privacidad. Los cambios se registran en tu cuenta y surten efecto de inmediato.',
            '· Permisos de ubicación y notificaciones — los ajustes del sistema para Rentivo en tu dispositivo.',
            '· Todo lo almacenado en el dispositivo — desinstalar la app lo elimina.',
            '· Tu cuenta y su registro en el servidor — Perfil, luego Configuración de privacidad y Eliminar cuenta. La supresión queda sujeta a los plazos de conservación de la Política de Privacidad.',
          ],
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════ MAGYAR ═══
  hu: {
    privacy: {
      title: 'Adatvédelmi tájékoztató',
      updated: '2026. augusztus 4.',
      version: '2.0',
      intro: 'A Rentivo autók, hajók, kerékpárok és nyaralók bérlésére szolgáló piactér a Mediterráneumban. Egy jármű bérlése valódi okmányok és valódi pénz átadását jelenti, ezért ez az oldal világosan leírja, mit gyűjtünk, milyen jogalapon, ki lát még bele, és hogyan kérheted, hogy hagyjuk abba.',
      sections: [
        {
          id: 'who-we-are',
          title: 'Kik vagyunk',
          body: [
            'A Rentivót magyarországi egyéni vállalkozó üzemelteti. Az adatkezelő:',
            '{{LEGAL_NAME}} egyéni vállalkozó, {{SEAT_ADDRESS}}, Magyarország. Nyilvántartási szám: {{REG_NUMBER}}. Adószám: {{TAX_NUMBER}}. E-mail: privacy@rentivo.app',
            'A Rentivo bérlőket köt össze független bérbeadó cégekkel és magánszemélyekkel. Foglaláskor magára a bérleti szerződésre nézve a bérbeadó önálló adatkezelő; mi a fiókodért, a foglalás nyilvántartásáért és a fizetésért felelünk.',
          ],
        },
        {
          id: 'what-we-collect',
          title: 'Mit gyűjtünk és miért',
          body: [
            'Nem gyűjtünk adatot előre, minden esetre. Minden alábbi kategória azért van, mert a szolgáltatás egy konkrét része nélküle nem működik.',
            '· Név, e-mail, telefonszám — fiók létrehozása, foglalás visszaigazolása, hogy a bérbeadó elérjen — Jogalap: szerződés teljesítése.',
            '· Kártyaadatok — fizetés és a kaució biztosítása. A Stripe kezeli; a kártyaszámot soha nem látjuk és nem tároljuk — Jogalap: szerződés teljesítése.',
            '· Jogosítvány és személyazonosító okmány adatai — annak igazolása, hogy jogszerűen bérelhetsz; csalásmegelőzés — Jogalap: szerződés és jogi kötelezettség.',
            '· Hozzávetőleges tartózkodási hely — a közeledben lévő járművek megjelenítése a térképen — Jogalap: hozzájárulásod; megtagadhatod, az app így is használható.',
            '· Járműállapot-fotók — bizonyíték az átvételi és visszaadási állapotról, hogy egy kaució-vita tényeken dőljön el — Jogalap: szerződés és jogos érdek a viták tisztességes rendezéséhez.',
            '· Üzenetek a bérbeadóval — az üzenetek kézbesítése és fordítása, ha eltérő nyelvet beszéltek — Jogalap: szerződés teljesítése.',
            '· Foglalási és számlaadatok — könyvelés és adózás — Jogalap: jogi kötelezettség.',
            '· Push-értesítési azonosító — értesítés a foglalás visszaigazolásáról vagy a jármű készenlétéről — Jogalap: hozzájárulásod.',
            '· Hibadiagnosztika — hibák felderítése és javítása — Jogalap: jogos érdek a működő alkalmazáshoz.',
          ],
        },
        {
          id: 'identity-verification',
          title: 'Személyazonosság-ellenőrzés',
          body: [
            'A személyazonosság ellenőrzéséhez fénykép kell az okmányodról és egy szelfi. Az arcadat biometrikus adat — a GDPR 9. cikke szerinti különleges kategória —, ezért az ellenőrzés megkezdése előtt kifejezett hozzájárulásodat kérjük. Ha nem járulsz hozzá, az ellenőrzést igénylő bérlést nem tudod befejezni, de az app többi része érintetlen marad.',
            'Az ellenőrzést a Didit nevű szolgáltatónk végzi. Az okmányképet és az arcszkennelést a Didit kezeli, és azok nem kerülnek a Rentivo rendszereibe. Amit megkapunk és megőrzünk, az kizárólag az eredmény:',
            '· az okmány típusa, kibocsátó országa, száma és lejárati dátuma;',
            '· az okmányon szereplő név és születési dátum;',
            '· egy számszerű arcegyezési pontszám és egy élőség-vizsgálati eredmény.',
            'Ezt azért őrizzük meg, hogy ne kelljen újra ellenőrizned magad, és hogy egy bérbeadó felé igazolni tudjuk: jogosult vagy a bérlésre.',
          ],
        },
        {
          id: 'processors',
          title: 'Ki kezeli még az adataid',
          body: [
            'Az alábbiak az adatfeldolgozóink. Mindegyiket adatfeldolgozói szerződés köti, és kizárólag a mi utasításunkra járhat el.',
            '· Supabase — adatbázis, bejelentkezés, fájltárolás — EU (Írország).',
            '· Stripe Payments Europe — fizetés, kaució, bérbeadói kifizetés — EU (Írország).',
            '· Didit — személyazonosság- és okmányellenőrzés — EU.',
            '· Anthropic — MI-asszisztens, üzenetfordítás, kárfotó-elemzés, árjavaslat — USA, SCC alapján.',
            '· Resend — tranzakciós e-mail — USA, SCC alapján.',
            '· Expo — push-értesítések — USA, SCC alapján.',
            '· Sentry — hibafigyelés — USA, SCC alapján.',
            '· CARTO / OpenStreetMap — térképcsempék; megkapja az IP-címed — EU / globális.',
            'Ahol a szolgáltató az Európai Gazdasági Térségen kívül van, az adattovábbítást az Európai Bizottság általános szerződési feltételei (SCC) fedik. Személyes adataidat nem adjuk el, és reklámcélra nem osztjuk meg.',
          ],
        },
        {
          id: 'where-stored',
          title: 'Hol tároljuk',
          body: [
            'A fiókod, a foglalásaid, az üzeneteid és a fotóid az Európai Unióban (Írország) tárolódnak. A fizetési adatok a Stripe-nál maradnak, az EU-n belül. Kivételt a fenti amerikai szolgáltatók jelentenek, amelyek csak a funkciójukhoz szükséges konkrét adatot kapják meg.',
          ],
        },
        {
          id: 'retention',
          title: 'Meddig őrizzük',
          body: [
            '· Fiókadatok — amíg a fiókod létezik. Ha az appban törlöd, 30 napon belül töröljük, azon kívül, amit jogszabály őrizni rendel.',
            '· Foglalások és számlák — ameddig a számviteli jogszabály előírja. A számvitelről szóló 2000. évi C. törvény 169. §-a alapján a számviteli bizonylatokat nyolc évig kell megőrizni.',
            '· Járműállapot-fotók — a bérlés végétől számított 12 hónapig, hogy egy később bejelentett kárigény is bizonyíték alapján dőljön el.',
            '· Ellenőrzési eredmények — az okmány lejártáig vagy a fiókod törléséig.',
            '· Hibadiagnosztika — 90 nap.',
          ],
        },
        {
          id: 'your-rights',
          title: 'A jogaid',
          body: [
            'A GDPR alapján kérheted, hogy:',
            '· adjunk másolatot a rólad kezelt személyes adatokról;',
            '· helyesbítsük a pontatlan adatokat;',
            '· töröljük az adataidat — az appban van Fiók törlése funkció, ami ezt azonnal elindítja;',
            '· korlátozzuk a kezelést, vagy tiltakozhatsz a jogos érdeken alapuló kezelés ellen;',
            '· hordozhasd az adataidat másik szolgáltatóhoz géppel olvasható formátumban;',
            '· bármikor visszavonhasd a hozzájárulásod — helymeghatározás, értesítések vagy biometrikus ellenőrzés esetén —, ami a korábbi kezelés jogszerűségét nem érinti.',
            'Írj a privacy@rentivo.app címre. Egy hónapon belül válaszolunk.',
            'Ha úgy látod, hibáztunk, panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH) — 1055 Budapest, Falk Miksa utca 9–11., ugyfelszolgalat@naih.hu, +36 1 391 1400 —, vagy bírósághoz fordulhatsz a lakóhelyed szerinti törvényszéken.',
          ],
        },
        {
          id: 'automated-decisions',
          title: 'Automatizált döntések és MI',
          body: [
            'A személyazonosság-ellenőrzés részben automatizált. MI-t használunk továbbá az asszisztens válaszainak megfogalmazásához, a köztetek folyó üzenetek fordításához, a bérbeadóknak szóló árjavaslatokhoz, és a kárfotókon lehetséges sérülések megjelöléséhez.',
            'Rád nézve joghatással vagy hasonlóan jelentős hatással járó döntést gép önmagában nem hoz. Az MI kárjelzése kifejezetten javaslat a bérbeadó felé: ember bírálja el, mielőtt bármilyen terhelés érné a kauciód, és minden terhelést megtámadhatsz az app vitarendezési folyamatában. Automatizált eredmény esetén bármikor kérheted az emberi felülvizsgálatot.',
          ],
        },
        {
          id: 'security',
          title: 'Biztonság',
          body: [
            'Az adatok átvitel közben (TLS) és nyugalmi állapotban is titkosítottak. Az éles adatokhoz való hozzáférés korlátozott és naplózott. Az adatbázis-hozzáférés soronként szabályozott, így egyik felhasználó rekordjai sem érhetők el egy másik felhasználó munkamenetéből. A kártyaszámok soha nem érintik a szervereinket — azokat közvetlenül a Stripe gyűjti.',
            'Ha egy adatvédelmi incidens veszélyeztetné a jogaidat, 72 órán belül értesítjük a felügyeleti hatóságot, téged pedig indokolatlan késedelem nélkül.',
          ],
        },
        {
          id: 'children',
          title: 'Gyermekek',
          body: [
            'A Rentivo nem 18 év alattiaknak készült, és a jármű bérlése érvényes vezetői engedélyt igényel. Tudatosan nem gyűjtünk adatot gyermekektől. Ha úgy véled, gyermek adott meg nekünk adatot, írj, és töröljük.',
          ],
        },
        {
          id: 'changes',
          title: 'Változások',
          body: [
            'Ha módosítjuk a tájékoztatót, frissítjük a fenti dátumot és emeljük a verziószámot. A jogaidat érdemben érintő változásról a hatálybalépés előtt értesítünk az appban vagy e-mailben.',
          ],
        },
        {
          id: 'contact',
          title: 'Kapcsolat',
          body: [
            '{{LEGAL_NAME}} egyéni vállalkozó · {{SEAT_ADDRESS}}, Magyarország',
            'Adatvédelmi megkeresések: privacy@rentivo.app',
          ],
        },
      ],
    },
    terms: {
      title: 'Általános Szerződési Feltételek',
      updated: '2026. augusztus 4.',
      version: '2.0',
      intro: 'Kérjük, figyelmesen olvasd el ezeket a feltételeket a Rentivo használata előtt. Az alkalmazás használatával elfogadod, hogy ezek kötnek.',
      sections: [
        {
          id: 'service',
          title: 'A szolgáltatás leírása',
          body: [
            'A Rentivo közösségi bérlési piactér, amely jármű- és eszköztulajdonosokat („Bérbeadók”) köt össze bérlőkkel („Fogyasztók”). A Rentivo közvetítő platformként jár el, és nem részese a Bérbeadó és a Fogyasztó közötti bérleti szerződésnek.',
          ],
        },
        {
          id: 'obligations',
          title: 'Felhasználói kötelezettségek',
          body: [
            'A Rentivo használatához legalább 18 évesnek kell lenned, és érvényes vezetői engedéllyel kell rendelkezned minden olyan járműhöz, amely ezt megköveteli.',
            'Vállalod, hogy pontos adatokat adsz meg, biztonságban tartod a fiókodat, a bérelt dolgot felelősen és a helyi jogszabályoknak megfelelően használod, és abban az állapotban adod vissza, ahogy átvetted.',
          ],
        },
        {
          id: 'payments',
          title: 'Fizetés és platformdíj',
          body: [
            'Minden fizetést a Stripe dolgoz fel. A Rentivo tranzakciónként {{PLATFORM_FEE}} platformdíjat számít fel. A fizetéskor az árbontásban megjelenő díj az, amit ténylegesen felszámítunk.',
            'Ha egy foglalás kauciót igényel, előre semmilyen összeget nem vonunk le. Ehelyett a kártyád a hozzájárulásoddal a Stripe-nál kerül eltárolásra, hogy kár megállapítása esetén később terhelhető legyen a kaució. Ha nem jelentenek kárt, semmilyen terhelés nem történik.',
          ],
        },
        {
          id: 'cancellation',
          title: 'Lemondás',
          body: [
            'Minden hirdetésnek saját lemondási szabályzata van (Rugalmas, Mérsékelt vagy Szigorú). Az alkalmazandó szabályzat megjelenik a hirdetésen és a fizetésnél is. A Rentivo platformdíja semmilyen esetben nem téríthető vissza.',
          ],
        },
        {
          id: 'damage-waiver',
          title: 'Kárátvállalás és felelősség',
          body: [
            'A Rentivo nem biztosító, és nem értékesít biztosítást. A bérelt járművel harmadik félnek okozott kárt a jármű saját kötelező gépjármű-felelősségbiztosítása fedezi, amelynek megkötésére a Bérbeadó jogszabály szerint köteles — nem a Rentivo.',
            'A Rentivo ettől függetlenül opcionális, fizetős kárátvállalást kínál. Ez szerződéses kárátvállalás, nem biztosítási termék, és nem ígérünk hozzá összeghatárt, mert nincs mögötte biztosítási szerződés.',
            'Fizetős kárátvállalás esetén a kaució 0 €, és a Rentivo csökkenti vagy megszünteti a bérelt dologban okozott kárért viselt saját felelősségedet, legfeljebb az egyébként alkalmazandó kaució összegéig. Fizetős kárátvállalás nélkül a teljes kaució érvényes, és a károkért továbbra is te felelsz.',
            'A Rentivo nem felel közvetett vagy következményi károkért.',
          ],
        },
        {
          id: 'damage-disputes',
          title: 'Károk és viták',
          body: [
            'A károkat az átvételkor vagy a visszaadáskor kell bejelenteni az alkalmazás állapotfelmérő eszközével, amely fényképeket rögzít a dolog állapotáról.',
            'A vitákat elsősorban a Fogyasztó és a Bérbeadó rendezi egymás között. A Rentivo közvetíthet, de eredményt nem garantál. A valótlan kárbejelentés a fiók felfüggesztését vonhatja maga után.',
          ],
        },
        {
          id: 'governing-law',
          title: 'Alkalmazandó jog',
          body: [
            'A Rentivót magyarországi egyéni vállalkozó üzemelteti. Ezekre a feltételekre a magyar jog irányadó, és a magyar bíróságok rendelkeznek joghatósággal.',
            'Ha az Európai Unióban lakóhellyel rendelkező fogyasztó vagy, ez nem fosztja meg téged a lakóhelyed szerinti ország kötelező fogyasztóvédelmi szabályainak védelmétől, és eljárást ezen ország bíróságai előtt is indíthatsz.',
          ],
        },
      ],
    },
    cookies: {
      title: 'Süti- és tárolási tájékoztató',
      updated: '2026. augusztus 4.',
      version: '2.0',
      intro: 'A Rentivo natív mobilalkalmazás, nem weboldal, ezért nem helyez el böngészősütiket. Ugyanakkor kis mennyiségű adatot tárol az eszközöd alkalmazás-tárhelyén, és néhány azonosítót használ. Ez az oldal ezeket írja le, mert ugyanazokat a kérdéseket vetik fel, mint a sütik.',
      sections: [
        {
          id: 'not-a-browser',
          title: 'Miért nem sütitájékoztató ez',
          body: [
            'A süti böngészős megoldás. A Rentivo alkalmazás nem böngészőben fut, és nem használ sütit. Mobilalkalmazásban ennek megfelelője az eszközön tárolt helyi kulcs-érték adat, valamint az operációs rendszer és a push-szolgáltatónk által kiadott azonosítók — mindet felsoroljuk alább.',
            'A Rentivo weboldalai, köztük ez is, nem helyeznek el sütit, és nem futtatnak hirdetési vagy analitikai szkriptet. Betöltenek viszont egy webfontot a Google Fontsról, amely a kérés részeként megkapja az IP-címed.',
          ],
        },
        {
          id: 'essential-storage',
          title: 'Alapvető tárolás',
          body: [
            'Ezek az alkalmazás működéséhez szükségesek, és nem kapcsolhatók ki. Az eszközödön maradnak, amíg nem törlöd az alkalmazás adatait vagy nem távolítod el, és sehová nem továbbítjuk őket.',
            '· Bejelentkezési munkamenet — a hitelesítési munkameneted az eszközön tárolódik, hogy két indítás között is bejelentkezve maradj.',
            '· Hozzájárulás rögzítése (gdpr_accepted) — hogy tudomásul vetted-e az adatvédelmi tájékoztatót, így a hozzájárulási képernyő nem jelenik meg minden indításkor.',
            '· Nyelvválasztás (user_language) — hogy az app az általad választott nyelven nyíljon meg.',
            '· Bevezető és beállítási jelzők (onboarding_seen, onboarding_complete, operator_setup_complete, host_setup_complete, coachmarks) — hogy a bevezető képernyők és a súgóbuborékok csak egyszer jelenjenek meg.',
            '· Ellenőrzésre váró telefonszám (pending_otp_phone) — csak a belépési kód kérése és beírása között tároljuk.',
          ],
        },
        {
          id: 'convenience-storage',
          title: 'Kényelmi tárolás',
          body: [
            'Ezek csak kényelmesebbé teszik az alkalmazást. Az eszközön maradnak, és soha nem töltjük fel őket.',
            '· Legutóbbi keresések (rentivo_search_history) — az utolsó öt keresésed, hogy újra felkínálhassuk. Ha törlöd őket, eltűnnek az eszközről.',
            '· Utolsó megnyitás időbélyege (rentivo_last_opened) — kizárólag arra szolgál, hogy hosszabb szünet után üdvözlő üzenetet mutassunk.',
          ],
        },
        {
          id: 'identifiers',
          title: 'Azonosítók és az eszközt elhagyó adatok',
          body: [
            '· Push-értesítési azonosító — az Expo push-szolgáltatása adja ki, amikor engedélyezed az értesítéseket, és a fiókodhoz tárolódik, hogy a foglalási hírek elérjenek. Ha a Profil, majd az Adatvédelmi beállítások alatt kikapcsolod a pusht, a tárolt azonosítót töröljük.',
            '· Hozzávetőleges tartózkodási hely — csak akkor kérjük, ha a térképet használod, és csak ha megadod az engedélyt. A térképcsempéket a CARTO / OpenStreetMap szolgáltatja, amely megkapja az IP-címed.',
            '· Hibadiagnosztika — a Sentry hibajelentéseket és teljesítménymintákat kap, hogy a hibák felderíthetők és javíthatók legyenek.',
          ],
        },
        {
          id: 'no-advertising',
          title: 'Analitika és marketing',
          body: [
            'A Rentivo nem tartalmaz hirdetési SDK-t, alkalmazások közötti követést és hirdetési azonosítót. Harmadik féltől származó termékanalitikai SDK-t sem tartalmaz: az alkalmazást elhagyó egyetlen használati adat a fent leírt hiba- és teljesítményjelentés.',
            'A marketingbeállításokat — hogy kérsz-e ajánlatokat e-mailben vagy pushon — a fiókodhoz rögzítjük, nem az eszköz tárhelyén, és alapértelmezetten ki vannak kapcsolva.',
          ],
        },
        {
          id: 'manage',
          title: 'Hogyan kezelheted',
          body: [
            '· Marketing- és analitikai hozzájárulás — Profil, majd Adatvédelmi beállítások. A változás a fiókodhoz rögzül, és azonnal hatályba lép.',
            '· Helymeghatározási és értesítési engedélyek — az eszközöd rendszerbeállításai a Rentivóra vonatkozóan.',
            '· Minden, ami az eszközön tárolódik — az alkalmazás eltávolítása törli.',
            '· A fiókod és a kiszolgálón tárolt adatai — Profil, majd Adatvédelmi beállítások, majd Fiók törlése. A törlésre az Adatvédelmi tájékoztatóban megadott megőrzési idők vonatkoznak.',
          ],
        },
      ],
    },
  },
}
