import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateFingerprint } from "@/lib/fingerprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CreatePoll = () => {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [maxVotes, setMaxVotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    generateFingerprint().then(setFingerprint);
  }, []);

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map(o => o.trim()).filter(o => o.length > 0);

    if (!trimmedQuestion) {
      toast.error("Please enter a question");
      return;
    }
    if (trimmedOptions.length < 2) {
      toast.error("Please add at least 2 options");
      return;
    }
    if (new Set(trimmedOptions).size !== trimmedOptions.length) {
      toast.error("Options must be unique");
      return;
    }

    const parsedMaxVotes = maxVotes.trim() ? parseInt(maxVotes.trim(), 10) : null;
    if (parsedMaxVotes !== null && (isNaN(parsedMaxVotes) || parsedMaxVotes < 1)) {
      toast.error("Max votes must be a positive number");
      return;
    }

    setLoading(true);
    try {
      const { data: poll, error: pollError } = await supabase
        .from("polls")
        .insert({
          question: trimmedQuestion,
          creator_fingerprint: fingerprint,
          max_votes: parsedMaxVotes,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      const optionRows = trimmedOptions.map((label, index) => ({
        poll_id: poll.id,
        label,
        position: index,
      }));

      const { error: optError } = await supabase
        .from("poll_options")
        .insert(optionRows);

      if (optError) throw optError;

      toast.success("Poll created!");
      navigate(`/poll/${poll.share_code}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create poll");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Create a Poll
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight">
            Ask your audience
          </h1>
          <p className="text-muted-foreground mt-2">
            Create a poll and share the link to collect votes in real time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Your question</label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we have for lunch?"
              className="h-12 text-base"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Options</label>
            <div className="space-y-3">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="h-11"
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                type="button"
                variant="ghost"
                onClick={addOption}
                className="mt-3 text-primary"
              >
                <Plus className="w-4 h-4 mr-1" /> Add option
              </Button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Max votes to auto-close <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              type="number"
              value={maxVotes}
              onChange={(e) => setMaxVotes(e.target.value)}
              placeholder="e.g. 1000 — leave blank for unlimited"
              className="h-11"
              min={1}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Poll will automatically close and declare a winner after this many votes.
            </p>
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
            {loading ? "Creating..." : "Create Poll"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreatePoll;
