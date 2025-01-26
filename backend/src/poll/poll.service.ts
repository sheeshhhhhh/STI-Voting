import { ForbiddenException, GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserType } from 'src/lib/decorator/User.decorator';
import { CreatePollDto } from './dto/poll.dto';

@Injectable()
export class PollService {
    constructor(
        @Inject('POSTGRES_POOL') private readonly sql: any
    ) {}

    async createPoll(user: UserType, body: CreatePollDto) {
        const pollCreate = await this.sql`
            INSERT INTO poll (title, description, branch, start_date, end_date, vote_type)
            VALUES (${body.title}, ${body.description}, ${user.branch} ,${body.start_date}, ${body.end_date}, ${body.vote_type})
            RETURNING *;
        `

        if(!pollCreate.length) {
            throw new GoneException('failed to create Poll')
        }

        return pollCreate[0]
    }

    async getPolls(user: UserType, search: string) {
        const branch = user.branch;

        const getPollsForUser = await this.sql`
            SELECT p.*, 
            COALESCE(
                JSON_AGG(pa.name) FILTER (WHERE pa.name IS NOT NULL),
                '[]'
            ) AS parties
            FROM poll p
            LEFT JOIN parties pa ON p.id = pa.poll_id
            WHERE branch = ${branch}
            GROUP BY p.id;
        `

        return getPollsForUser
    }

    async getResults(user: UserType) {
        const branch = user.branch;

        const getResultsForUser = await this.sql`
            SELECT p.*,
            COALESCE(
                JSON_AGG(pa.name) FILTER (WHERE pa.id IS NOT NULL),
                '[]'
            ) as parties
            FROM poll p
            LEFT JOIN parties pa ON p.id = pa.poll_id
            WHERE p.branch = ${branch} AND p.end_date < NOW()
            GROUP BY p.id;
        `

        return getResultsForUser
    }

    async getPollStatistics(user: UserType, pollId: string) {
        const branch = user.branch;

        const getPollStatisticsForUser = await this.sql`
            SELECT 
                p.id, p.title, p.start_date, p.end_date,
                (
                    SELECT COUNT(DISTINCT v2.id)
                    FROM votes v2
                    WHERE v2.poll_id = p.id
                )::INT AS total_votes,
                (
                    SELECT COUNT(DISTINCT pa.id)
                    FROM parties pa
                    WHERE pa.poll_id = p.id
                )::INT AS participating_parties,
                CASE 
                    WHEN CURRENT_TIMESTAMP < p.start_date THEN 'Upcoming'
                    WHEN CURRENT_TIMESTAMP BETWEEN p.start_date AND p.end_date THEN 'Ongoing'
                    WHEN CURRENT_TIMESTAMP > p.end_date THEN 'Completed'
                END AS status,
                (
                    SELECT JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'vote_date', TO_CHAR(vote_date, 'MM-DD'),
                            'votes_per_day', votes_count
                        )
                        ORDER BY vote_date
                    )
                    FROM (
                        SELECT
                            ds.vote_date,
                            COUNT(DISTINCT v.id) as votes_count
                        FROM(
                            SELECT generate_series(
                                p.start_date::DATE, p.end_date::DATE, '1 day'::INTERVAL
                            )::DATE AS vote_date
                        ) ds
                        LEFT JOIN votes v ON ds.vote_date = DATE(v.created_at)
                        AND v.poll_id = p.id
                        GROUP BY ds.vote_date
                    ) AS daily_votes
                ) AS votes_stats
            FROM poll p
            WHERE p.id = ${pollId} AND p.branch = ${branch};
        `
    
        return getPollStatisticsForUser[0];
    }

    async getPoll(user: UserType, pollId: string) {
        const branch = user.branch; 
        
        const getPollForUser = await this.sql`
            SELECT p.*, 
            COALESCE(
                JSON_AGG(
                    DISTINCT JSON_BUILD_OBJECT(
                        'id', pa.id,
                        'name', pa.name,
                        'description', pa.description,
                        'banner', pa.banner
                    )::jsonb
                ) FILTER (WHERE pa.id IS NOT NULL),
                '[]'
            ) as parties,
            COALESCE(
                JSON_AGG(
                    DISTINCT JSON_BUILD_OBJECT(
                        'id', po.id,
                        'position', po.position,
                        'description', po.description
                    )::jsonb
                ) FILTER (WHERE po.id IS NOT NULL),
                '[]'
            ) as positions,
            (
                SELECT COUNT(DISTINCT v2.id) 
                FROM votes v2 
                WHERE v2.poll_id = p.id
            )::INT as votesCast,
            (
                SELECT EXISTS (
                    SELECT 1
                    FROM votes v2 
                    WHERE v2.user_id = ${user.id} 
                    AND v2.poll_id = p.id 
                )
            ) as hasVoted,
            p.end_date::DATE - NOW()::DATE as daysRemaining -- get day remaining
            FROM poll p
            LEFT JOIN parties pa ON p.id = pa.poll_id
            LEFT JOIN positions po ON p.id = po.poll_id
            WHERE p.branch = ${branch} AND p.id = ${pollId} 
            GROUP BY p.id;
        `

        if(!getPollForUser.length) {
            throw new NotFoundException('Poll not found')
        }

        return getPollForUser[0]
    }
    
    async getPollForVoting(user: UserType, pollId: string) {
        const branch = user.branch;

        const getVotes = await this.sql`
            SELECT id, poll_id, user_id 
            FROM votes
            WHERE poll_id = ${pollId} AND user_id = ${user.id};
        `

        if(getVotes.length) {
            throw new ForbiddenException('You have already voted')
        }

        const getPoll = await this.sql`
            WITH candidate_data AS (
                SELECT 
                    c.position_id,
                    (
                        SELECT JSON_AGG(sub.obj)
                        FROM (
                            SELECT JSON_BUILD_OBJECT(
                                'id', c2.id,
                                'photo', c2.photo,
                                'name', c2.name,
                                'description', c2.description,
                                'party_id', c2.party_id
                            )::jsonb AS obj
                            FROM candidates c2
                            WHERE c2.position_id = c.position_id
                            ORDER BY party_id
                        ) sub
                    ) AS candidates
                FROM candidates c
                GROUP BY c.position_id
            ),
            position_data AS (
                SELECT 
                    po.poll_id,
                    JSON_AGG(
                        DISTINCT JSON_BUILD_OBJECT(
                            'id', po.id,
                            'description', po.description,
                            'position', po.position,
                            'candidates', COALESCE(cd.candidates, '[]')
                        )::jsonb
                    ) AS positions
                FROM positions po
                LEFT JOIN candidate_data cd ON po.id = cd.position_id
                GROUP BY po.poll_id
            )
            SELECT 
                p.*,
                COALESCE(pd.positions, '[]') as positions
            FROM poll p
            LEFT JOIN position_data pd ON p.id = pd.poll_id
            WHERE p.branch = ${branch} AND p.id = ${pollId};
        `

        if(!getPoll.length) {
            throw new NotFoundException('Poll not found')
        }

        return getPoll[0];
    }

    async getResult(user: UserType, pollId: string) {
        const branch = user.branch;

        // get turnout later
        const getResultForUser = await this.sql`
            SELECT p.id, p.title, p.description, p.start_date, p.end_date, p.vote_type, p.branch,
            COALESCE(
                JSON_AGG(
                   DISTINCT pa.name
                ) FILTER (WHERE pa.id IS NOT NULL),
                '[]'
            ) as parties,
            (
                SELECT COUNT(v.id)
                FROM votes v
                WHERE v.poll_id = p.id
            ) as totalVotes,
            (
                SELECT EXISTS(
                    SELECT 1
                    FROM votes v
                    WHERE v.poll_id = p.id
                    AND v.user_id = ${user.id}
                )
            ) as hasVoted,
            COALESCE (
                JSON_AGG(
                    DISTINCT JSON_BUILD_OBJECT(
                        'position_id', winners.position_id,
                        'position', winners.position,
                        'winners', winners.winner
                    )::jsonb
                ) FILTER (WHERE winners.position_id IS NOT NULL),
                '[]'
            ) as position_winners
            -- get results or winner, depending if it is single or multiple choice
            FROM poll p
            LEFT JOIN parties pa ON p.id = pa.poll_id
            LEFT JOIN LATERAL (
                SELECT DISTINCT ON (po.id)
                    po.id as position_id,
                    po.position,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', c.id,
                            'name', c.name,
                            'photo', c.photo,
                            'description', c.description,
                            'party_id', c.party_id,
                            'party', pa.name,
                            'votes', vote_counts.total_votes
                        )
                    ) AS winner
                FROM positions po
                LEFT JOIN candidates c ON po.id = c.position_id
                LEFT JOIN parties pa ON c.party_id = pa.id
                LEFT JOIN LATERAL (
                    SELECT 
                        COUNT(v.id) as total_votes,
                        ROW_NUMBER() OVER (ORDER BY COUNT(v.id) DESC) AS rank
                    FROM candidatesvoted v
                    WHERE v.candidate_id = c.id
                    GROUP BY v.candidate_id
                ) vote_counts ON TRUE
                WHERE po.poll_id = p.id AND vote_counts.rank = 1 --Only get the winner
                GROUP BY po.id
            ) winners ON TRUE
            WHERE p.branch = ${branch} AND p.id = ${pollId}
            GROUP BY p.id;
        `

        if(!getResultForUser.length) {
            throw new NotFoundException('Poll not found')
        }

        // check if pooll has ended using date
        if(new Date(getResultForUser[0].end_date) > new Date()) {
            throw new ForbiddenException('Poll has not ended')
        }
        
        return getResultForUser[0]
    }

    async getResultStatistics(user: UserType, pollId: string) {
        const branch = user.branch;

        const getResultStatisticsForUser = await this.sql`
            WITH candidate_data AS (
                SELECT 
                    c.position_id,
                    (
                        SELECT JSON_AGG(sub.obj)
                        FROM (
                            SELECT JSON_BUILD_OBJECT(
                                'id', c2.id,
                                'name', c2.name,
                                'party_id', c2.party_id,
                                'votes', (
                                    SELECT COUNT(v.id)
                                    FROM candidatesvoted v
                                    WHERE v.candidate_id = c2.id
                                )
                            )::jsonb AS obj
                            FROM candidates c2
                            WHERE c2.position_id = c.position_id
                            ORDER BY party_id
                        ) sub
                    ) AS candidates
                FROM candidates c
                GROUP BY c.position_id
            ),
            position_data AS (
                SELECT 
                    po.poll_id,
                    JSON_AGG(
                        DISTINCT JSON_BUILD_OBJECT(
                            'id', po.id,
                            'position', po.position,
                            'candidates', COALESCE(cd.candidates, '[]')
                        )::jsonb
                    ) AS positions
                FROM positions po
                LEFT JOIN candidate_data cd ON po.id = cd.position_id
                GROUP BY po.poll_id
            )
            SELECT 
                COALESCE(pd.positions, '[]') as positions
            FROM poll p
            LEFT JOIN position_data pd ON p.id = pd.poll_id
            WHERE p.branch = ${branch} AND p.id = ${pollId} AND p.end_date < NOW();
        `

        return getResultStatisticsForUser[0];
    }

    async updatePoll(user: UserType, pollId: string, body: CreatePollDto) {

        const updatePoll = await this.sql`
            UPDATE poll 
            SET 
                title = ${body.title},
                description = ${body.description},
                start_date = ${body.start_date},
                end_date = ${body.end_date},
                vote_type = ${body.vote_type}
            WHERE id = ${pollId}
            RETURNING *;
        `

        if(!updatePoll.length) {
            throw new GoneException('failed to update Poll')
        }

        return updatePoll[0]
    }

    // should i delete or archive the poll?
    async deletePoll(user: UserType, pollId: string) {

        const deletePoll = await this.sql`
            DELETE FROM poll
            WHERE id = ${pollId}
            RETURNING *;
        `

        if(!deletePoll.length) {
            throw new GoneException('failed to delete Poll')
        }

        return deletePoll[0]
    }
}
