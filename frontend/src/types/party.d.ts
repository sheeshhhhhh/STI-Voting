import { poll } from "./poll"

export type party = {
    id: number,
    name: string,
    description?: string,
    banner?: string,
    poll_id: number,

    created_at: string,
    updated_at: string,
}

export type partyTable = {
    branch: poll['branch'],
    title: poll['title']
} & party

export type partyBasicInfo = {
    id: party['id'],
    name: party['name'],
    description: party['description'],
    banner: party['banner'],
}