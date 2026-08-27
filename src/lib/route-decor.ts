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
    /** Slow travelling highlight running along this band once it has been drawn. */
    pulse?: boolean;
    /** Extra seconds before the highlight starts, used to stagger parallel lanes. */
    pulseDelay?: number;
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

export interface RouteDecorMover {
    points: readonly RouteDecorPoint[];
    radius: number;
    color: RouteDecorColor;
    size: number;
    layer?: number;
    delay?: number;
    duration?: number;
}

export interface RouteDecorScene {
    viewBox: string;
    /** SVG preserveAspectRatio alignment; `slice` scenes may crop at viewport edges. */
    align?: string;
    shapes: readonly RouteDecorShape[];
    nodes?: readonly RouteDecorNode[];
    movers?: readonly RouteDecorMover[];
}

export interface RouteDecorPreset {
    /** Styling and placement variant, see _route-decor.scss. */
    variant: 'hero' | 'intro' | 'airport';
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

export interface RouteDecorMoverItem {
    kind: 'mover';
    d: string;
    color: string;
    size: number;
    delay: number;
    duration: number;
}

export type RouteDecorItem = RouteDecorBandItem | RouteDecorPulseItem | RouteDecorNodeItem | RouteDecorMoverItem;

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

            if (band.pulse) {
                ordered.push({
                    // Highlights ride on top of their own route.
                    layer: layer + 0.5,
                    item: {
                        kind: 'pulse',
                        d: geometry.d,
                        width: round(band.width * PULSE_WIDTH_RATIO),
                        delay: round(delay + duration + (band.pulseDelay ?? 0)),
                    },
                });
            }
        }
    }

    for (const mover of scene.movers ?? []) {
        const geometry = buildBandGeometry(mover.points, mover.radius, 0, 0);
        ordered.push({
            layer: mover.layer ?? 10,
            item: {
                kind: 'mover',
                d: geometry.d,
                color: colorToken(mover.color),
                size: mover.size,
                delay: mover.delay ?? 0,
                duration: mover.duration ?? 8,
            },
        });
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

export type RouteDecorPresetName = 'homeHero' | 'pageIntro' | 'airportIntro';

export const ROUTE_DECOR_PRESETS: Record<RouteDecorPresetName, RouteDecorPreset> = {
    homeHero: {
        variant: 'hero',
        wide: {
            viewBox: '0 0 1440 560',
            shapes: [
                {
                    points: [
                        [-760, 96],
                        [900, 96],
                        [900, 452],
                        [2060, 452],
                    ],
                    radius: 96,
                    layer: 1,
                    bands: [
                        { color: 1, width: 34, offset: 0 },
                        { color: 3, width: 15, offset: 0, pulse: true },
                    ],
                    delay: 0.1,
                    duration: 2.9,
                },
                {
                    points: [
                        [1160, -240],
                        [1160, 300],
                        [640, 300],
                        [640, 780],
                    ],
                    radius: 76,
                    layer: 2,
                    bands: [{ color: 2, width: 27, offset: 0, pulse: true, pulseDelay: 0.8 }],
                    delay: 0.55,
                    duration: 2.6,
                },
                {
                    points: [
                        [2060, 190],
                        [1250, 190],
                        [1250, 384],
                        [1010, 384],
                    ],
                    radius: 62,
                    layer: 3,
                    bands: [{ color: 3, width: 20, offset: 0, arrow: 36, pulse: true, pulseDelay: 1.4 }],
                    delay: 1,
                    duration: 2.2,
                },
                {
                    points: [
                        [-760, 524],
                        [470, 524],
                        [470, 800],
                    ],
                    radius: 56,
                    layer: 0,
                    bands: [{ color: 2, width: 18, offset: 0, pulse: true, pulseDelay: 2 }],
                    delay: 0.9,
                    duration: 2,
                },
            ],
            nodes: [
                {
                    at: [900, 300],
                    layer: -1,
                    rings: [
                        { color: 2, r: 44 },
                        { color: 1, r: 29 },
                        { color: 4, r: 13 },
                    ],
                    delay: 1.6,
                },
                {
                    at: [1250, 190],
                    layer: -1,
                    rings: [
                        { color: 4, r: 20 },
                        { color: 2, r: 8 },
                    ],
                    delay: 1.9,
                },
            ],
        },
        narrow: {
            viewBox: '0 0 420 680',
            align: 'xMidYMid slice',
            shapes: [
                {
                    points: [
                        [-460, 250],
                        [150, 250],
                        [150, 600],
                        [760, 600],
                    ],
                    radius: 56,
                    layer: 1,
                    bands: [
                        { color: 1, width: 22, offset: 0 },
                        { color: 3, width: 10, offset: 0, pulse: true },
                    ],
                    delay: 0.1,
                    duration: 2.6,
                },
                {
                    points: [
                        [300, -160],
                        [300, 430],
                        [-160, 430],
                    ],
                    radius: 52,
                    layer: 2,
                    bands: [{ color: 2, width: 19, offset: 0, arrow: 30, pulse: true, pulseDelay: 0.8 }],
                    delay: 0.6,
                    duration: 2.2,
                },
            ],
            nodes: [
                {
                    at: [150, 430],
                    layer: -1,
                    rings: [
                        { color: 2, r: 30 },
                        { color: 4, r: 12 },
                    ],
                    delay: 1.4,
                },
            ],
        },
    },
    pageIntro: {
        variant: 'intro',
        wide: {
            viewBox: '0 0 1440 260',
            align: 'xMidYMid slice',
            shapes: [
                {
                    points: [
                        [650, 66],
                        [1010, 66],
                        [1010, 204],
                        [1540, 204],
                    ],
                    radius: 44,
                    layer: 1,
                    bands: [
                        { color: 1, width: 28, offset: 0 },
                        { color: 3, width: 12, offset: 0, pulse: true },
                    ],
                    delay: 0.05,
                    duration: 2.5,
                },
                {
                    points: [
                        [1235, -100],
                        [1235, 132],
                        [860, 132],
                        [860, 340],
                    ],
                    radius: 38,
                    layer: 2,
                    bands: [{ color: 2, width: 21, offset: 0, pulse: true, pulseDelay: 0.8 }],
                    delay: 0.35,
                    duration: 2.25,
                },
                {
                    points: [
                        [1540, 38],
                        [1350, 38],
                        [1350, 132],
                        [1135, 132],
                    ],
                    radius: 32,
                    layer: 3,
                    bands: [{ color: 4, width: 16, offset: 0, arrow: 34 }],
                    delay: 0.7,
                    duration: 1.9,
                },
            ],
            nodes: [
                {
                    at: [1010, 132],
                    layer: -1,
                    rings: [
                        { color: 2, r: 35 },
                        { color: 1, r: 23 },
                        { color: 4, r: 10 },
                    ],
                    delay: 1.2,
                },
                {
                    at: [1350, 38],
                    layer: -1,
                    rings: [
                        { color: 4, r: 17 },
                        { color: 2, r: 7 },
                    ],
                    delay: 1.55,
                },
            ],
        },
        narrow: {
            viewBox: '0 0 420 260',
            align: 'xMidYMid slice',
            shapes: [
                {
                    points: [
                        [-140, 48],
                        [300, 48],
                        [300, 220],
                        [620, 220],
                    ],
                    radius: 38,
                    layer: 1,
                    bands: [
                        { color: 1, width: 22, offset: 0 },
                        { color: 3, width: 10, offset: 0, pulse: true },
                    ],
                    delay: 0.05,
                    duration: 2.2,
                },
                {
                    points: [
                        [520, 116],
                        [220, 116],
                        [220, 340],
                    ],
                    radius: 34,
                    layer: 2,
                    bands: [{ color: 2, width: 18, offset: 0, arrow: 28, pulse: true, pulseDelay: 0.8 }],
                    delay: 0.45,
                    duration: 1.9,
                },
            ],
            nodes: [
                {
                    at: [300, 116],
                    layer: -1,
                    rings: [
                        { color: 2, r: 27 },
                        { color: 4, r: 11 },
                    ],
                    delay: 1.1,
                },
            ],
        },
    },
    airportIntro: {
        variant: 'airport',
        wide: {
            viewBox: '0 0 1440 260',
            align: 'xMidYMid slice',
            shapes: [
                {
                    points: [
                        [680, 72],
                        [1540, 72],
                    ],
                    radius: 0,
                    layer: 3,
                    bands: [{ color: 4, width: 5, offset: 0 }],
                    delay: 0.15,
                    duration: 1.8,
                },
                {
                    points: [
                        [660, 224],
                        [920, 224],
                        [920, 136],
                        [1540, 136],
                    ],
                    radius: 42,
                    layer: 1,
                    bands: [{ color: 2, width: 24, offset: 0, pulse: true }],
                    delay: 0.05,
                    duration: 2.4,
                },
                {
                    points: [
                        [1540, 224],
                        [1220, 224],
                        [1220, 174],
                        [1040, 174],
                    ],
                    radius: 28,
                    layer: 2,
                    bands: [{ color: 1, width: 19, offset: 0, arrow: 32, pulse: true, pulseDelay: 0.7 }],
                    delay: 0.4,
                    duration: 2.1,
                },
            ],
            nodes: [
                {
                    at: [1220, 174],
                    layer: -1,
                    rings: [
                        { color: 2, r: 34 },
                        { color: 1, r: 22 },
                        { color: 4, r: 9 },
                    ],
                    delay: 1.1,
                },
            ],
            movers: [
                {
                    points: [
                        [680, 72],
                        [1540, 72],
                    ],
                    radius: 0,
                    color: 4,
                    size: 27,
                    delay: 2.5,
                    duration: 8.5,
                },
            ],
        },
        narrow: {
            viewBox: '0 0 420 260',
            align: 'xMidYMid slice',
            shapes: [
                {
                    points: [
                        [-80, 68],
                        [500, 68],
                    ],
                    radius: 0,
                    layer: 3,
                    bands: [{ color: 4, width: 4, offset: 0 }],
                    delay: 0.15,
                    duration: 1.6,
                },
                {
                    points: [
                        [-100, 220],
                        [250, 220],
                        [250, 124],
                        [620, 124],
                    ],
                    radius: 38,
                    layer: 1,
                    bands: [{ color: 2, width: 21, offset: 0, pulse: true }],
                    delay: 0.05,
                    duration: 2.1,
                },
                {
                    points: [
                        [620, 224],
                        [340, 224],
                        [340, 164],
                        [258, 164],
                    ],
                    radius: 30,
                    layer: 2,
                    bands: [{ color: 1, width: 17, offset: 0, arrow: 27, pulse: true, pulseDelay: 0.7 }],
                    delay: 0.4,
                    duration: 1.9,
                },
            ],
            nodes: [
                {
                    at: [340, 164],
                    layer: -1,
                    rings: [
                        { color: 2, r: 27 },
                        { color: 4, r: 10 },
                    ],
                    delay: 1,
                },
            ],
            movers: [
                {
                    points: [
                        [-80, 68],
                        [500, 68],
                    ],
                    radius: 0,
                    color: 4,
                    size: 23,
                    delay: 2.2,
                    duration: 7.5,
                },
            ],
        },
    },
};
