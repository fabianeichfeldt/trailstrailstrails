class BaseTrail {
    name: string = "";
    id: string = "";
    creator: string = "";
    url: string = "";
    instagram: string = "";
    latitude: number = 0;
    longitude: number = 0;
    approved: boolean = false;
    created_at: string = "";
}

export interface SingleTrail extends BaseTrail {
    type: "trail";
}

export interface BikePark extends BaseTrail {
    type: "bikepark";
}

export interface DirtPark extends BaseTrail {
    type: "dirtpark";
    pumptrack: boolean;
    dirtpark: boolean;
}

export type Trail = SingleTrail | BikePark | DirtPark;

export function isDirtPark(trail: Trail): trail is DirtPark {
    return trail.type === "dirtpark";
}
export function isBikePark(trail: Trail): trail is BikePark {
    return trail.type === "bikepark";
}
export function isTrail(trail: Trail): trail is SingleTrail {
    return trail.type === "trail";
}