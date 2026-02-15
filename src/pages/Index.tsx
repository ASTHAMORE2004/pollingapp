import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Shield, Zap, List } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Real-Time Results",
    description: "Votes update instantly for all viewers — no refresh needed.",
  },
  {
    icon: Shield,
    title: "Anti-Abuse Protection",
    description: "Browser fingerprinting and duplicate detection keep your polls fair.",
  },
  {
    icon: BarChart3,
    title: "Live Charts & Winner",
    description: "Animated bar charts, percentage breakdowns, and automatic winner declaration.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <BarChart3 className="w-4 h-4" />
            Real-Time Poll Rooms
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight leading-tight">
            Create polls.{" "}
            <span className="poll-gradient bg-clip-text text-transparent inline-block">
              Get answers.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-md mx-auto">
            Ask a question, share a link, and watch votes roll in — live. No signup required.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/create">
              <Button size="lg" className="h-13 px-8 text-base font-semibold gap-2">
                Create a Poll <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/polls">
              <Button size="lg" variant="outline" className="h-13 px-6 text-base font-semibold gap-2">
                <List className="w-5 h-5" /> Browse Polls
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
