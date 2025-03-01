import GoBackButton from "@/components/common/GoBackButton"
import SomethingWentWrong from "@/components/common/SomethingWentWrong"
import ElectionSkeleton from "@/components/skeletonLoading/Election.skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import axiosFetch from "@/lib/axios"
import { partyBasicInfo } from "@/types/party"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, CalendarIcon, Clock, Users, VoteIcon } from "lucide-react"
import { Link, Navigate, useParams } from "react-router"

const Election = () => {
    const { id } = useParams()

    const { data: election, isLoading, isError } = useQuery({
        queryKey: ['election', id],
        queryFn: async () => {
            const response = await axiosFetch.get(`/poll/${id}`)

            if(response.status === 404) {
                return undefined
            }

            if(response.status >= 400) {
                throw new Error(response.data.message);
            }

            return response.data
        },
        refetchOnWindowFocus: false,
        retry: false
    })

    if(isLoading) {
        return <ElectionSkeleton />
    }

    if(isError) {
        return <SomethingWentWrong />
    }

    if(!election) {
        return <Navigate to={'/notfound'} />
    }

    const startDate = new Date(election.start_date)
    const endDate = new Date(election.end_date)
    const now = new Date()
    
    let status
    if (now < startDate) {
        status = "upcoming"
    } else if (now >= startDate && now <= endDate) {
        status = "active"
    } else {
        status = "completed"
    }

    return (
        <div className="min-h-[855px] bg-white">
            <div className="pt-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                        <div className="flex justify-between items-center w-full">
                            <GoBackButton to={`/elections`}>
                                Back to Elections
                            </GoBackButton>
                            {status == "active" && (
                                <Button asChild className="">
                                    <Link to={'/live-results/' + id}>
                                        Live Result
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-4">
                <div className="grid gap-8 md:grid-cols-3">
                    <div className="md:col-span-2 space-y-6">
                        <Card>
                            <CardHeader className="flex-row justify-between items-center space-y-0">
                                <CardTitle className="text-2xl sm:text-3xl">
                                    {election.title}
                                </CardTitle>
                                <Badge 
                                variant={status === "active" ? "default" : "secondary"}
                                className={`${status === "active" ? "bg-green-500" : "bg-yellow-200 text-yellow-800"} text-lg`}>
                                    {status}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-600">{election.description}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Election Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
                                        <Users className="h-8 w-8 text-blue-600 mb-2" />
                                        <span className="text-2xl font-bold text-blue-600">
                                            {election.registered_voters?.toLocaleString()}
                                        </span>
                                        <span className="text-sm text-blue-600">Registered Voters</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg">
                                        <VoteIcon className="h-8 w-8 text-green-600 mb-2" />
                                        <span className="text-2xl font-bold text-green-600">
                                            {election.votescast?.toLocaleString()}
                                        </span>
                                        <span className="text-sm text-green-600">Votes Cast</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 bg-yellow-50 rounded-lg">
                                        <Clock className="h-8 w-8 text-yellow-600 mb-2" />
                                        <span className="text-2xl font-bold text-yellow-600">
                                            {election.voteforthe_last_hour}
                                        </span>
                                        <span className="text-sm text-yellow-600">Vote Withing the last hour</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg">
                                        <CalendarIcon className="h-8 w-8 text-red-600 mb-2" />
                                        <span className="text-2xl font-bold text-red-600">{election.daysremaining < 0 ? "Already Ended" : election.daysremaining}</span>
                                        <span className="text-sm text-red-600">Days Remaining</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Participating Parties</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {election.parties && election.parties.length > 0 ? (
                                    <div className="grid gap-6 sm:grid-cols-2">
                                        {election?.parties?.map((party: partyBasicInfo, index: number) => (
                                            <Card key={index}>
                                                <CardHeader className="p-0">
                                                    <img className="rounded-t-lg w-[366.33px] h-[168.16px]" src={party.banner} alt={party.name + 'banner'} />
                                                    <CardTitle className="px-6 py-2">
                                                        {party.name}
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p>{party.description}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center bg-yellow-100 rounded-lg p-4">
                                        <AlertTriangle className="mr-2 h-6 w-6 text-yellow-600" />
                                        <p className="text-yellow-700 font-medium">No parties have registered for this election yet.</p>
                                    </div>
                                )
                                }
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        {
                            status === "active" && election.allowed === true  ? 
                                election.hasvoted ? (
                                    <div className="space-y-1">
                                        <Button asChild className="w-full">
                                            <Link to={`/viewFinishVote/${id}`}>
                                                View Your Vote
                                            </Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <Button asChild className="w-full">
                                        <Link to={`/pollVote/${id}`}>
                                            Vote Now
                                        </Link> 
                                    </Button> 
                                )
                            : null
                        }
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Election Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center">
                                    <Users className="mr-2 h-5 w-5 text-yellow-600" />
                                    <span>{election.branch} Branch</span>
                                </div>
                                <div className="flex items-center">
                                    <VoteIcon className="mr-2 h-5 w-5 text-yellow-600" />
                                    <span>{election.vote_type === "single" ? "Single Choice" : "Multiple Choice"}</span>
                                </div>
                                <div className="flex items-center">
                                    <CalendarIcon className="mr-2 h-5 w-5 text-yellow-600" />
                                    <span>{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Eligible to vote:
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <h1 className="text-lg font-semibold">Education Level</h1>
                                        <div className="flex flex-wrap gap-1">
                                            {election?.allowed_education_levels?.map((education_level: string, idx: number) => (
                                                <Badge key={idx} className="capitalize">
                                                    {education_level}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h1 className="text-lg font-semibold">Course/Strand</h1>
                                        <div className="flex flex-wrap gap-1">
                                            {election?.allowed_courses?.map((course: string, idx: number) => (
                                                <Badge key={idx}>
                                                    {course}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Positions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-0">
                                {election.positions && election.positions.length > 0 ? (
                                    <ScrollArea className="h-96 p-6 pb-3 pt-0">
                                        <div className="space-y-3">
                                            {election.positions?.map((position: any) => (
                                                <div key={position.id}>
                                                    <div className="space-y-1 flex-1">
                                                        <p className="text-lg font-bold">{position.position}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {position.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="mx-3">
                                        <div className="flex items-center justify-center bg-yellow-100 rounded-lg px-6 py-3">
                                            <AlertTriangle className="mr-2 h-8 w-8 text-yellow-600" />
                                            <p className="text-yellow-700 font-medium">No positions have been added to this election yet.</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Election