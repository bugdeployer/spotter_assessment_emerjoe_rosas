// One definition of how each route looks, shared by the map lines and the route list swatches,
// so a driver can match a card to its line at a glance. The recommended route is solid; the
// alternatives are dashed.
const ROUTE_COLORS = ['#2563eb', '#0891b2', '#7c3aed']

export const routeColor = (id: number) => ROUTE_COLORS[id % ROUTE_COLORS.length]

export const ALTERNATIVE_DASH = '8 6'
