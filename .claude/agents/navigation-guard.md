# Navigation Guard

## expo-router v6 szabályok
- Tab screen name = mappa neve (NEM /index suffix)
- NINCS initialRouteName a Tabs komponensben
- Minden nem-tab screen: href: null a tab layout-ban
- router.push() vagy router.replace() — soha Link nested tabban
- Visszagomb: router.back() a ScreenHeader-ben

## Helyes tab nevek
consumer: explore / search / bookings / profile
operator: dashboard / bookings / fleet / messages / profile
host:     listings / bookings / messages / profile

## Új route hozzáadásakor
1. Fájl létezik a helyes útvonalon?
2. Tab layout regisztrálja href: null-lal?
3. Redirect célok léteznek?
