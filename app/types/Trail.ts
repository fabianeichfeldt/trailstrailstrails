export class BaseTrail {
    name: string = "";
    id: string = "";
    slug: string = "";
    creator: string = "";
    url: string = "";
    instagram: string = "";
    latitude: number = 0;
    longitude: number = 0;
    spotcheck: string = "";
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

export type anyTrailType = "dirtpark" | "bikepark" | "trail";

// Which GPX sections a spot type has — shared by SpotManager and the public spot page.
export const SPOT_GPX_SECTIONS: Record<anyTrailType, { trails: boolean; tours: boolean }> = {
    trail:    { trails: true,  tours: true },
    bikepark: { trails: true,  tours: false },
    dirtpark: { trails: false, tours: false },
};

export function hasGpx(type: anyTrailType): boolean {
    return SPOT_GPX_SECTIONS[type].trails || SPOT_GPX_SECTIONS[type].tours;
}

export function isAnyTrailType(type: string): type is anyTrailType {
    return type === "trail" || type === "bikepark" || type === "dirtpark";
}