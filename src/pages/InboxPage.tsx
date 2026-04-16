import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import PersonList from "./PersonList";
import PersonDetail from "./PersonDetail";
import ComposeModal from "./ComposeModal";
import type { Person } from "@/lib/api";

export default function InboxPage() {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <>
      {/* Middle panel — person list (hidden on mobile when a person is selected) */}
      <div
        className={`w-full md:w-80 shrink-0 border-r border-border-dark bg-panel ${
          selectedPerson ? "hidden md:block" : "block"
        }`}
      >
        <PersonList
          selectedPersonId={selectedPerson?.id ?? null}
          selectedRecipient={selectedPerson?.recipient ?? null}
          onSelectPerson={setSelectedPerson}
        />
      </div>

      {/* Right panel — email detail (hidden on mobile when no person selected) */}
      <div
        className={`flex-1 bg-main min-w-0 ${
          selectedPerson ? "block" : "hidden md:block"
        }`}
      >
        {selectedPerson ? (
          <div className="flex h-full flex-col">
            {/* Mobile back button */}
            <button
              onClick={() => setSelectedPerson(null)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary hover:text-text-primary md:hidden border-b border-border-dark"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="flex-1 overflow-hidden">
              <PersonDetail person={selectedPerson} />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            Select a person to view emails
          </div>
        )}
      </div>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </>
  );
}
