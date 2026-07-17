import { useState } from "react";
import { useLocation } from "wouter";
import { useStill } from "@/lib/store";

// Fictional sample entries, invented to demonstrate the engine (a recurring
// thread, a forgotten page, a distance travelled), never a real person's diary.
const SAMPLE_ENTRIES = `[2014-09-12]
First week in a new city and I already feel invisible, everyone here seems to know exactly where they're going. One more week and I'll figure it out. One more week, then I'll really begin.

[2015-11-03]
Couldn't sleep again, so I sat on the fire escape and watched the city not need me at all. It was strangely kind. I keep thinking I have to earn my place here. Maybe I just have to live here.

[2017-06-20]
Ready was never going to be a feeling. It's a door you walk through scared. I keep waiting to feel sure before I start, and the waiting is the only thing that's ever certain.

[2019-02-14]
Cried in the office bathroom again and told no one. Am I doing enough? Am I enough? Be patient with yourself, you're still learning. (I keep saying that like it'll stick.)

[2021-07-08]
We danced in the kitchen until the rice burned. I want to keep this exact afternoon, the bad music, the open window, nowhere else I needed to be.

[2023-04-30]
Reread my old entries tonight. I used to write "I don't think I'll ever feel at home here" almost every month. I haven't written it in two years. I didn't even notice it leave.

[2024-10-15]
Maybe I don't have to fix this. Maybe I just have to feel it and let it pass. Be patient with yourself, you've come such a long way.`;

export default function Paste() {
  const [, setLocation] = useLocation();
  const { entries, setEntries } = useStill();

  const handleUseSample = () => {
    setEntries(SAMPLE_ENTRIES);
  };

  const handleSubmit = () => {
    if (!entries.trim()) return;
    setLocation("/processing");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 max-w-[680px] mx-auto py-12 md:py-24">
      <h1 className="font-display text-4xl text-deep-brown mb-4">
        Bring a few pages.
      </h1>
      <p className="text-lg text-soft-ink mb-8 leading-relaxed">
        Paste 20–30 dated entries from different moments in your life. Messy is fine. The dates matter.
      </p>
      
      <div className="flex-1 flex flex-col gap-6 mb-8">
        <textarea
          value={entries}
          onChange={(e) => setEntries(e.target.value)}
          placeholder="[2015-08-24]\nToday I felt..."
          className="w-full flex-1 min-h-[400px] bg-surface border border-border rounded-sm p-6 text-lg text-ink font-body placeholder:text-faint-ink focus:outline-none focus:ring-1 focus:ring-accent-sepia resize-none shadow-sm"
        />
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={handleSubmit}
            disabled={!entries.trim()}
            className="w-full sm:w-auto bg-ink hover:bg-deep-brown disabled:bg-faint-ink text-surface px-8 py-3 rounded-sm font-body text-lg transition-colors"
          >
            Find what's worth returning to
          </button>
          
          <button
            onClick={handleUseSample}
            className="text-accent-sepia hover:text-deep-brown font-body text-lg underline decoration-accent-sepia/30 underline-offset-4"
          >
            Use sample entries
          </button>
        </div>
      </div>
    </div>
  );
}
