import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Users, Trophy, Clock } from "lucide-react";

interface PollSummary {
  id: string;
  question: string;
  share_code: string;
  created_at: string;
  is_active: boolean;
  max_votes: number | null;
  vote_count: number;
}

const AllPolls = () => {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolls = async () => {
      const { data: pollsData } = await supabase
        .from("polls")
        .select("id, question, share_code, created_at, is_active, max_votes")
        .order("created_at", { ascending: false });

      if (!pollsData) {
        setLoading(false);
        return;
      }

      // Fetch vote counts for all polls
      const { data: votes } = await supabase.from("votes").select("poll_id");

      const voteCounts: Record<string, number> = {};
      votes?.forEach(v => {
        voteCounts[v.poll_id] = (voteCounts[v.poll_id] || 0) + 1;
      });

      setPolls(
        pollsData.map(p => ({
          ...p,
          vote_count: voteCounts[p.id] || 0,
        }))
      );
      setLoading(false);
    };

    fetchPolls();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <Link to="/create">
            <Button size="sm" className="gap-1">
              Create Poll <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold font-display tracking-tight mb-6">All Polls</h1>

        {loading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : polls.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No polls created yet.</p>
            <Link to="/create">
              <Button>Create your first poll</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {polls.map(poll => (
              <Link key={poll.id} to={`/poll/${poll.share_code}`}>
                <div className="glass-card rounded-xl p-5 hover:border-primary/40 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display font-semibold text-lg truncate group-hover:text-primary transition-colors">
                        {poll.question}
                      </h2>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {poll.vote_count} vote{poll.vote_count !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(poll.created_at)}
                        </span>
                        {poll.max_votes && (
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5" />
                            {poll.vote_count}/{poll.max_votes}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                        poll.is_active
                          ? "bg-accent/15 text-accent"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {poll.is_active ? "Active" : "Closed"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllPolls;
