// Build-time geometry for the decorative transit-route graphics.
//
// A route is a centre polyline. Every band is a true parallel offset of it:
// the waypoints are mitred outwards and each corner radius is adjusted by the
// offset, so all bands of a route share their arc centres. That keeps the
// perpendicular spacing exactly constant through straight runs and bends alike,
// and guarantees bands never drift into or cross each other at a turn.
//
// Paint order is explicit: every drawable carries a layer and the scene is
// flattened into a single ordered list, so crossings are designed rather than a
// side effect of markup order.

export type RouteDecorPoint = readonly [number, number];

/** Palette slot, resolved to the --route-decor-color-N custom property. */
export type RouteDecorColor = 1 | 2 | 3 | 4;

export interface RouteDecorBand {
    color: RouteDecorColor;
    /** Stroke width in scene units. */
    width: number;
    /** Perpendicular distance from the centre line, positive to the right of travel. */
    offset?: number;
    /** Arrowhead length in scene units, drawn at the end of this band. */
    arrow?: number;
    /** Shortens the band at its end, used to stagger arrowheads of parallel lanes. */
    trimEnd?: number;
}

export interface RouteDecorShape {
    /** Waypoints in scene units; points outside the viewBox let a route run off-canvas. */
    points: readonly RouteDecorPoint[];
    /** Corner radius of the centre line; each band derives its own from this. */
    radius: number;
    /** Bands of one route, listed casing first so cores paint inside them. */
    bands: readonly RouteDecorBand[];
    /** Paint order across the whole scene; higher paints later. */
    layer?: number;
    /** Slow travelling highlight along the last band once the route is drawn. */
    pulse?: boolean;
    /** Reveal timing in seconds. */
    delay?: number;
    duration?: number;
}

/** Concentric target marker; rings are drawn largest first. */
export interface RouteDecorNode {
    at: RouteDecorPoint;
    rings: readonly { color: RouteDecorColor; r: number }[];
    /** Paint order across the whole scene; negative keeps routes running over the target. */
    layer?: number;
    delay?: number;
}

export interface RouteDecorScene {
    viewBox: string;
    /** SVG preserveAspectRatio; scenes are never cropped, they bleed past the viewBox instead. */
    align?: string;
    shapes: readonly RouteDecorShape[];
    nodes?: readonly RouteDecorNode[];
}

export interface RouteDecorPreset {
    /** Styling and placement variant, see _route-decor.scss. */
    variant: 'hero' | 'soft';
    wide: RouteDecorScene;
    /** Optional portrait composition used below the 768px breakpoint. */
    narrow?: RouteDecorScene;
}

export interface RouteDecorBandItem {
    kind: 'band';
    d: string;
    arrow: string | null;
    stroke: string;
    width: number;
    delay: number;
    duration: number;
    arrowDelay: number;
}

export interface RouteDecorPulseItem {
    kind: 'pulse';
    d: string;
    width: number;
    delay: number;
}

export interface RouteDecorNodeItem {
    kind: 'node';
    transform: string;
    rings: { fill: string; r: number; delay: number }[];
}

export type RouteDecorItem = RouteDecorBandItem | RouteDecorPulseItem | RouteDecorNodeItem;

export interface RouteDecorSceneRender {
    viewBox: string;
    align: string;
    /** Drawables in final paint order. */
    items: RouteDecorItem[];
}

interface Vector {
    x: number;
    y: number;
}

const DEFAULT_ALIGN = 'xMidYMid meet';
const DEFAULT_DURATION = 2.2;
const ARROW_WIDTH_RATIO = 0.62;
const PULSE_WIDTH_RATIO = 0.55;
const COLLINEAR_EPSILON = 0.02;

const round = (value: number): number => Math.round(value * 100) / 100;

const pair = (x: number, y: number): string => `${round(x)} ${round(y)}`;

const colorToken = (color: RouteDecorColor): string => `var(--route-decor-color-${color})`;

/** Normal pointing to the right of the travel direction (SVG y axis points down). */
const rightOf = (direction: Vector): Vector => ({ x: -direction.y, y: direction.x });

const directionsOf = (points: readonly RouteDecorPoint[]): Vector[] => {
    const directions: Vector[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
        const dx = points[i + 1][0] - points[i][0];
        const dy = points[i + 1][1] - points[i][1];
        const length = Math.hypot(dx, dy);
        directions.push(length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length });
    }
    return directions;
};

/** Interior angle between the two arms meeting at a corner. */
const cornerAngle = (incoming: Vector, outgoing: Vector): number =>
    Math.acos(Math.min(1, Math.max(-1, -incoming.x * outgoing.x - incoming.y * outgoing.y)));

/**
 * Corner radii measured on the centre line. Clamping happens once, here, so
 * every band of the route is derived from the same effective radius and the
 * bands stay parallel even where a turn had to be tightened.
 */
const centreRadii = (points: readonly RouteDecorPoint[], radius: number, directions: Vector[]): number[] => {
    const radii: number[] = [];
    for (let i = 1; i < points.length - 1; i += 1) {
        const incoming = directions[i - 1];
        const outgoing = directions[i];
        const angle = cornerAngle(incoming, outgoing);
        if (angle < COLLINEAR_EPSILON || Math.PI - angle < COLLINEAR_EPSILON) {
            radii.push(0);
            continue;
        }
        const half = Math.tan(angle / 2);
        const inLength = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        const outLength = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
        const tangent = Math.min(radius / half, inLength / 2, outLength / 2);
        radii.push(tangent * half);
    }
    return radii;
};

/** Waypoints of the centre line shifted perpendicular by `offset`, mitred at the corners. */
const offsetWaypoints = (
    points: readonly RouteDecorPoint[],
    directions: Vector[],
    offset: number,
    trimEnd: number,
): RouteDecorPoint[] => {
    const last = points.length - 1;
    const first = rightOf(directions[0]);
    const waypoints: RouteDecorPoint[] = [[points[0][0] + first.x * offset, points[0][1] + first.y * offset]];

    for (let i = 1; i < last; i += 1) {
        const incoming = directions[i - 1];
        const outgoing = directions[i];
        const normalIn = rightOf(incoming);
        const normalOut = rightOf(outgoing);
        const denominator = 1 + incoming.x * outgoing.x + incoming.y * outgoing.y;
        // A full reversal has no mitre point; fall back to the incoming normal.
        const mitre =
            denominator < 1e-6
                ? normalIn
                : { x: (normalIn.x + normalOut.x) / denominator, y: (normalIn.y + normalOut.y) / denominator };
        waypoints.push([points[i][0] + mitre.x * offset, points[i][1] + mitre.y * offset]);
    }

    const endDirection = directions[last - 1];
    const endNormal = rightOf(endDirection);
    waypoints.push([
        points[last][0] + endNormal.x * offset - endDirection.x * trimEnd,
        points[last][1] + endNormal.y * offset - endDirection.y * trimEnd,
    ]);

    return waypoints;
};

/** Polyline with a circular fillet of the given radius at each corner. */
const filletPath = (points: readonly RouteDecorPoint[], radii: readonly number[]): string => {
    if (points.length < 2) {
        return '';
    }

    const commands: string[] = [`M ${pair(points[0][0], points[0][1])}`];

    for (let i = 1; i < points.length - 1; i += 1) {
        const [previousX, previousY] = points[i - 1];
        const [cornerX, cornerY] = points[i];
        const [nextX, nextY] = points[i + 1];
        const inLength = Math.hypot(cornerX - previousX, cornerY - previousY);
        const outLength = Math.hypot(nextX - cornerX, nextY - cornerY);
        const radius = radii[i - 1];
        if (inLength === 0 || outLength === 0 || radius <= 0) {
            commands.push(`L ${pair(cornerX, cornerY)}`);
            continue;
        }

        const inX = (previousX - cornerX) / inLength;
        const inY = (previousY - cornerY) / inLength;
        const outX = (nextX - cornerX) / outLength;
        const outY = (nextY - cornerY) / outLength;
        const angle = Math.acos(Math.min(1, Math.max(-1, inX * outX + inY * outY)));
        if (angle < COLLINEAR_EPSILON || Math.PI - angle < COLLINEAR_EPSILON) {
            commands.push(`L ${pair(cornerX, cornerY)}`);
            continue;
        }

        const half = Math.tan(angle / 2);
        const tangent = Math.min(radius / half, inLength / 2, outLength / 2);
        const filletRadius = round(tangent * half);
        const sweep = inX * outY - inY * outX < 0 ? 1 : 0;

        commands.push(`L ${pair(cornerX + inX * tangent, cornerY + inY * tangent)}`);
        commands.push(
            `A ${filletRadius} ${filletRadius} 0 0 ${sweep} ${pair(cornerX + outX * tangent, cornerY + outY * tangent)}`,
        );
    }

    const [lastX, lastY] = points[points.length - 1];
    commands.push(`L ${pair(lastX, lastY)}`);
    return commands.join(' ');
};

interface BandGeometry {
    d: string;
    waypoints: RouteDecorPoint[];
}

/**
 * One parallel band of a route. Its corner radii are the centre radii adjusted
 * by the offset, which puts every band of the route on the same arc centres.
 */
export const buildBandGeometry = (
    points: readonly RouteDecorPoint[],
    radius: number,
    offset: number,
    trimEnd = 0,
): BandGeometry => {
    if (points.length < 2) {
        return { d: '', waypoints: [] };
    }

    const directions = directionsOf(points);
    const radii = centreRadii(points, radius, directions);
    const waypoints = offsetWaypoints(points, directions, offset, trimEnd);

    const bandRadii = radii.map((centreRadius, index) => {
        if (centreRadius <= 0) {
            return 0;
        }
        const incoming = directions[index];
        const outgoing = directions[index + 1];
        const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
        // Inside of a turn shrinks by the offset, outside grows by it.
        return Math.max(0, centreRadius - offset * Math.sign(cross));
    });

    return { d: filletPath(waypoints, bandRadii), waypoints };
};

/** Filled arrowhead on the band's own end, pointing along its final segment. */
export const arrowHeadPath = (waypoints: readonly RouteDecorPoint[], length: number): string | null => {
    if (waypoints.length < 2) {
        return null;
    }

    const [endX, endY] = waypoints[waypoints.length - 1];
    const [beforeX, beforeY] = waypoints[waypoints.length - 2];
    const segment = Math.hypot(endX - beforeX, endY - beforeY);
    if (segment === 0) {
        return null;
    }

    const dirX = (endX - beforeX) / segment;
    const dirY = (endY - beforeY) / segment;
    const half = length * ARROW_WIDTH_RATIO;

    return [
        `M ${pair(endX - dirY * half, endY + dirX * half)}`,
        `L ${pair(endX + dirX * length, endY + dirY * length)}`,
        `L ${pair(endX + dirY * half, endY - dirX * half)}`,
        'Z',
    ].join(' ');
};

/** Resolves a scene into one draw list ordered by layer. */
export const buildRouteDecorScene = (scene: RouteDecorScene): RouteDecorSceneRender => {
    const ordered: { layer: number; item: RouteDecorItem }[] = [];

    for (const node of scene.nodes ?? []) {
        const delay = node.delay ?? 0;
        ordered.push({
            layer: node.layer ?? -1,
            item: {
                kind: 'node',
                transform: `translate(${pair(node.at[0], node.at[1])})`,
                rings: node.rings.map((ring, index) => ({
                    fill: colorToken(ring.color),
                    r: ring.r,
                    delay: round(delay + index * 0.12),
                })),
            },
        });
    }

    for (const shape of scene.shapes) {
        const layer = shape.layer ?? 0;
        const delay = shape.delay ?? 0;
        const duration = shape.duration ?? DEFAULT_DURATION;

        for (const band of shape.bands) {
            const geometry = buildBandGeometry(shape.points, shape.radius, band.offset ?? 0, band.trimEnd ?? 0);
            ordered.push({
                layer,
                item: {
                    kind: 'band',
                    d: geometry.d,
                    arrow: band.arrow ? arrowHeadPath(geometry.waypoints, band.arrow) : null,
                    stroke: colorToken(band.color),
                    width: band.width,
                    delay,
                    duration,
                    arrowDelay: round(delay + duration * 0.82),
                },
            });
        }

        const core = shape.bands[shape.bands.length - 1];
        if (shape.pulse && core) {
            const geometry = buildBandGeometry(shape.points, shape.radius, core.offset ?? 0, core.trimEnd ?? 0);
            ordered.push({
                // Highlights ride on top of their own route.
                layer: layer + 0.5,
                item: {
                    kind: 'pulse',
                    d: geometry.d,
                    width: round(core.width * PULSE_WIDTH_RATIO),
                    delay: round(delay + duration),
                },
            });
        }
    }

    return {
        viewBox: scene.viewBox,
        align: scene.align ?? DEFAULT_ALIGN,
        items: ordered
            .map((entry, index) => ({ ...entry, index }))
            .sort((a, b) => a.layer - b.layer || a.index - b.index)
            .map((entry) => entry.item),
    };
};

export type RouteDecorPresetName = 'homeHero' | 'airportBanner';

// Lane widths are chosen so neighbouring lanes clear each other: two 30 unit
// lanes sit 34 apart, leaving a deliberate 4 unit channel between them.
export const ROUTE_DECOR_PRESETS: Record<RouteDecorPresetName, RouteDecorPreset> = {
    // Home hero: a corridor of two parallel lines framing the copy on the left
    // and bottom, plus a U-turn hook in the upper right. Both routes run well
    // past the viewBox so they keep bleeding off the section edges on any
    // viewport aspect.
    homeHero: {
        variant: 'hero',
        wide: {
            viewBox: '0 0 1440 560',
            shapes: [
                {
                    points: [
                        [-620, 104],
                        [264, 104],
                        [264, 452],
                        [2060, 452],
                    ],
                    radius: 88,
                    layer: 1,
                    bands: [
                        { color: 1, width: 30, offset: 0 },
                        { color: 2, width: 30, offset: -34 },
                        { color: 3, width: 18, offset: -34 },
                    ],
                    pulse: true,
                    delay: 0.1,
                    duration: 2.8,
                },
                {
                    points: [
                        [1010, -360],
                        [1010, 168],
                        [1196, 168],
                        [1196, 316],
                        [1040, 316],
                    ],
                    radius: 62,
                    layer: 2,
                    bands: [
                        { color: 1, width: 30, offset: 0 },
                        { color: 3, width: 18, offset: 0, arrow: 38 },
                    ],
                    delay: 0.65,
                    duration: 2.1,
                },
            ],
            nodes: [
                {
                    at: [206, 250],
                    layer: -1,
                    rings: [
                        { color: 2, r: 54 },
                        { color: 1, r: 34 },
                        { color: 4, r: 14 },
                    ],
                    delay: 0.35,
                },
                {
                    // Cyan reads against the amber core that runs over it.
                    at: [1130, 344],
                    layer: -1,
                    rings: [
                        { color: 2, r: 32 },
                        { color: 4, r: 12 },
                    ],
                    delay: 1.5,
                },
            ],
        },
        // Portrait composition: the copy fills the width on phones, so the
        // corridor hugs the left edge and the second route drops down the right
        // margin instead of cutting through the paragraphs.
        narrow: {
            viewBox: '0 0 420 680',
            shapes: [
                {
                    points: [
                        [-320, 108],
                        [48, 108],
                        [48, 520],
                        [760, 520],
                    ],
                    radius: 56,
                    layer: 1,
                    bands: [
                        { color: 1, width: 24, offset: 0 },
                        { color: 2, width: 24, offset: -28 },
                        { color: 3, width: 14, offset: -28 },
                    ],
                    pulse: true,
                    delay: 0.1,
                    duration: 2.6,
                },
                {
                    points: [
                        [760, 40],
                        [368, 40],
                        [368, 596],
                    ],
                    radius: 52,
                    // Crosses the corridor near the buttons; drawn over it so the
                    // casing reads as a deliberate bridge.
                    layer: 3,
                    bands: [
                        { color: 1, width: 26, offset: 0 },
                        { color: 3, width: 14, offset: 0, arrow: 40 },
                    ],
                    delay: 0.6,
                    duration: 2.2,
                },
            ],
            nodes: [
                {
                    at: [10, 236],
                    layer: -1,
                    rings: [
                        { color: 2, r: 40 },
                        { color: 1, r: 25 },
                        { color: 4, r: 10 },
                    ],
                    delay: 0.35,
                },
            ],
        },
    },

    // Airport page: a smaller corner accent anchored to the top right of the
    // opening section, arriving from the top and turning back into the copy.
    // The inner lane stops short of the outer one so the single arrowhead never
    // reaches across its neighbour.
    airportBanner: {
        variant: 'soft',
        wide: {
            viewBox: '0 0 640 420',
            shapes: [
                {
                    points: [
                        [190, -320],
                        [190, 150],
                        [470, 150],
                        [470, 286],
                        [300, 286],
                    ],
                    radius: 58,
                    layer: 1,
                    bands: [
                        { color: 1, width: 26, offset: 0, trimEnd: 78 },
                        { color: 2, width: 26, offset: -30 },
                        { color: 3, width: 15, offset: -30, arrow: 34 },
                    ],
                    pulse: true,
                    delay: 0.1,
                    duration: 2.4,
                },
            ],
            nodes: [
                {
                    at: [132, 92],
                    layer: -1,
                    rings: [
                        { color: 2, r: 44 },
                        { color: 1, r: 28 },
                        { color: 4, r: 12 },
                    ],
                    delay: 0.3,
                },
            ],
        },
    },
};
