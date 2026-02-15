import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateFingerprint } from "@/lib/fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check, Copy, Link as LinkIcon, ArrowLeft, Users,
  Trophy, Plus, Trash2, Edit2, X, Power, PowerOff
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface PollOption {
  id: string;
  label: string;
  position: number;
  vote_count: number;
}

interface Poll {
  id: string;
  question: string;
  share_code: string;
  created_at: string;
  is_active: boolean;
  max_votes: number | null;
  creator_fingerprint: string;
  closed_at: string | null;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PollRoom = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // Edit states
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState("");
  const [newOptionLabel, setNewOptionLabel] = useState("");

  const fetchVoteCounts = useCallback(async (pollId: string, optionIds: string[]) => {
    const { data: votes } = await supabase
      .from("votes")
      .select("option_id")
      .eq("poll_id", pollId);

    const counts: Record<string, number> = {};
    optionIds.forEach(id => { counts[id] = 0; });
    votes?.forEach(v => {
      if (counts[v.option_id] !== undefined) counts[v.option_id]++;
    });
    return counts;
  }, []);

  useEffect(() => {
    const init = async () => {
      const fp = await generateFingerprint();
      setFingerprint(fp);

      const { data: pollData, error: pollErr } = await supabase
        .from("polls")
        .select("*")
        .eq("share_code", shareCode)
        .single();

      if (pollErr || !pollData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPoll(pollData as Poll);
      setEditQuestion(pollData.question);
      setIsCreator(fp === pollData.creator_fingerprint);

      const { data: optData } = await supabase
        .from("poll_options")
        .select("*")
        .eq("poll_id", pollData.id)
        .order("position");

      const optionIds = (optData || []).map(o => o.id);
      const counts = await fetchVoteCounts(pollData.id, optionIds);

      setOptions(
        (optData || []).map(o => ({ ...o, vote_count: counts[o.id] || 0 }))
      );

      const { data: existingVote } = await supabase
        .from("votes")
        .select("option_id")
        .eq("poll_id", pollData.id)
        .eq("voter_fingerprint", fp)
        .maybeSingle();

      if (existingVote) {
        setHasVoted(true);
        setVotedOptionId(existingVote.option_id);
      }

      setLoading(false);

      // Subscribe to realtime vote changes
      const votesChannel = supabase
        .channel(`poll-votes-${pollData.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "votes", filter: `poll_id=eq.${pollData.id}` },
          async () => {
            const newCounts = await fetchVoteCounts(pollData.id, optionIds);
            setOptions(prev =>
              prev.map(o => ({ ...o, vote_count: newCounts[o.id] || 0 }))
            );
          }
        )
        .subscribe();

      // Subscribe to poll status changes
      const pollChannel = supabase
        .channel(`poll-status-${pollData.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "polls", filter: `id=eq.${pollData.id}` },
          (payload) => {
            setPoll(prev => prev ? { ...prev, ...payload.new } as Poll : null);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(votesChannel);
        supabase.removeChannel(pollChannel);
      };
    };

    init();
  }, [shareCode, fetchVoteCounts]);

  // Auto-close when max_votes reached
  useEffect(() => {
    if (!poll || !poll.is_active || !poll.max_votes) return;
    const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0);
    if (totalVotes >= poll.max_votes) {
      supabase
        .from("polls")
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq("id", poll.id)
        .then(() => {
          setPoll(prev => prev ? { ...prev, is_active: false, closed_at: new Date().toISOString() } : null);
        });
    }
  }, [options, poll]);

  const castVote = async () => {
    if (!selectedOption || !poll || !fingerprint) return;
    if (!poll.is_active) {
      toast.error("This poll is closed");
      return;
    }

    setVoting(true);
    try {
      const { error } = await supabase.from("votes").insert({
        poll_id: poll.id,
        option_id: selectedOption,
        voter_fingerprint: fingerprint,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("You have already voted on this poll");
          setHasVoted(true);
        } else {
          throw error;
        }
      } else {
        setHasVoted(true);
        setVotedOptionId(selectedOption);
        toast.success("Vote cast!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to vote");
    } finally {
      setVoting(false);
    }
  };

  const togglePollActive = async () => {
    if (!poll) return;
    const newActive = !poll.is_active;
    const { error } = await supabase
      .from("polls")
      .update({
        is_active: newActive,
        closed_at: newActive ? null : new Date().toISOString(),
      })
      .eq("id", poll.id);
    if (error) {
      toast.error("Failed to update poll");
    } else {
      setPoll(prev => prev ? { ...prev, is_active: newActive, closed_at: newActive ? null : new Date().toISOString() } : null);
      toast.success(newActive ? "Poll reopened!" : "Poll closed!");
    }
  };

  const deletePoll = async () => {
    if (!poll || !confirm("Delete this poll permanently?")) return;
    // Delete votes, options, then poll
    await supabase.from("votes").delete().eq("poll_id", poll.id);
    await supabase.from("poll_options").delete().eq("poll_id", poll.id);
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);
    if (error) {
      toast.error("Failed to delete poll");
    } else {
      toast.success("Poll deleted");
      navigate("/");
    }
  };

  const saveQuestion = async () => {
    if (!poll || !editQuestion.trim()) return;
    const { error } = await supabase
      .from("polls")
      .update({ question: editQuestion.trim() })
      .eq("id", poll.id);
    if (error) {
      toast.error("Failed to update question");
    } else {
      setPoll(prev => prev ? { ...prev, question: editQuestion.trim() } : null);
      setEditing(false);
      toast.success("Question updated!");
    }
  };

  const addNewOption = async () => {
    if (!poll || !newOptionLabel.trim()) return;
    const maxPos = options.length > 0 ? Math.max(...options.map(o => o.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("poll_options")
      .insert({ poll_id: poll.id, label: newOptionLabel.trim(), position: maxPos })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add option");
    } else {
      setOptions(prev => [...prev, { ...data, vote_count: 0 }]);
      setNewOptionLabel("");
      toast.success("Option added!");
    }
  };

  const deleteOption = async (optId: string) => {
    if (options.length <= 2) {
      toast.error("Poll must have at least 2 options");
      return;
    }
    // Delete votes for this option first
    await supabase.from("votes").delete().eq("option_id", optId);
    const { error } = await supabase.from("poll_options").delete().eq("id", optId);
    if (error) {
      toast.error("Failed to delete option");
    } else {
      setOptions(prev => prev.filter(o => o.id !== optId));
      toast.success("Option removed");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0);

  // Determine winner
  const winner = totalVotes > 0 && !poll?.is_active
    ? options.reduce((best, o) => o.vote_count > best.vote_count ? o : best, options[0])
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading poll...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-display mb-2">Poll not found</h1>
          <p className="text-muted-foreground mb-6">This poll doesn't exist or the link is invalid.</p>
          <Link to="/">
            <Button><ArrowLeft className="w-4 h-4 mr-2" /> Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            {isCreator && (
              <>
                <Button variant="outline" size="sm" onClick={togglePollActive} className="gap-1">
                  {poll?.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {poll?.is_active ? "Close" : "Reopen"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} className="gap-1">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={deletePoll} className="gap-1 text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Share"}
            </Button>
          </div>
        </div>

        {/* Poll closed banner */}
        {!poll?.is_active && (
          <div className="mb-4 rounded-xl border-2 border-accent bg-accent/10 p-4 text-center">
            <p className="font-semibold text-accent flex items-center justify-center gap-2">
              <PowerOff className="w-4 h-4" /> This poll is closed
            </p>
            {poll?.max_votes && totalVotes >= poll.max_votes && (
              <p className="text-xs text-muted-foreground mt-1">
                Auto-closed after reaching {poll.max_votes} votes
              </p>
            )}
          </div>
        )}

        {/* Winner banner */}
        {winner && (
          <div className="mb-4 rounded-xl border-2 border-primary bg-primary/10 p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="font-bold font-display text-lg">Winner</span>
            </div>
            <p className="text-xl font-semibold">{winner.label}</p>
            <p className="text-sm text-muted-foreground">
              {winner.vote_count} vote{winner.vote_count !== 1 ? "s" : ""} ({totalVotes > 0 ? ((winner.vote_count / totalVotes) * 100).toFixed(1) : 0}%)
            </p>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6 md:p-8">
          {/* Question */}
          {editing ? (
            <div className="flex gap-2 mb-4">
              <Input
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                className="text-lg font-bold"
                maxLength={200}
              />
              <Button size="sm" onClick={saveQuestion}><Check className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditQuestion(poll?.question || ""); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight mb-1">
              {poll?.question}
            </h1>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Users className="w-4 h-4" />
            <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
            {poll?.max_votes && (
              <span className="text-xs">/ {poll.max_votes} max</span>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {options.map((opt, i) => {
              const pct = totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0;
              const color = CHART_COLORS[i % CHART_COLORS.length];
              const isSelected = selectedOption === opt.id;
              const isVotedOption = votedOptionId === opt.id;
              const isWinner = winner?.id === opt.id;

              return (
                <div key={opt.id} className="flex gap-2">
                  <button
                    onClick={() => !hasVoted && poll?.is_active && setSelectedOption(opt.id)}
                    disabled={hasVoted || !poll?.is_active}
                    className={`relative flex-1 text-left rounded-xl border-2 p-4 transition-all overflow-hidden ${
                      isWinner
                        ? "border-primary ring-2 ring-primary/30"
                        : hasVoted || !poll?.is_active
                        ? "cursor-default border-border"
                        : isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40 cursor-pointer"
                    }`}
                  >
                    {(hasVoted || totalVotes > 0) && (
                      <div
                        className="absolute inset-y-0 left-0 opacity-15 transition-all duration-700 ease-out rounded-xl"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    )}
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected || isVotedOption
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {(isSelected || isVotedOption) && (
                            <Check className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="font-medium">{opt.label}</span>
                        {isWinner && <Trophy className="w-4 h-4 text-primary" />}
                      </div>
                      {(hasVoted || totalVotes > 0) && (
                        <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                          {opt.vote_count} ({pct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </button>
                  {editing && isCreator && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteOption(opt.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add option (edit mode) */}
          {editing && isCreator && options.length < 10 && (
            <div className="flex gap-2 mt-3">
              <Input
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                placeholder="New option..."
                className="h-10"
                maxLength={100}
              />
              <Button size="sm" onClick={addNewOption} disabled={!newOptionLabel.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Vote button */}
          {!hasVoted && poll?.is_active && (
            <Button
              className="w-full h-12 text-base font-semibold mt-6"
              disabled={!selectedOption || voting}
              onClick={castVote}
            >
              {voting ? "Voting..." : "Cast Vote"}
            </Button>
          )}

          {hasVoted && poll?.is_active && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              ✓ You've voted. Results update in real time.
            </p>
          )}

          {/* Animated Bar Chart */}
          {totalVotes > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Live Results</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={options.map((opt, i) => ({
                      name: opt.label.length > 15 ? opt.label.slice(0, 15) + "…" : opt.label,
                      votes: opt.vote_count,
                      fill: CHART_COLORS[i % CHART_COLORS.length],
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="votes" radius={[0, 6, 6, 0]} animationDuration={800} animationEasing="ease-out">
                      {options.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Share link */}
        <div className="mt-6 glass-card rounded-xl p-4 flex items-center gap-3">
          <LinkIcon className="w-5 h-5 text-muted-foreground shrink-0" />
          <code className="text-sm text-muted-foreground truncate flex-1">
            {window.location.href}
          </code>
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PollRoom;
