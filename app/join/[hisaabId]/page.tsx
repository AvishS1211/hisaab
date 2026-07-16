import { Book } from "../../../src/components/Book";
import { entries, people, hisaabs, members } from "../../../src/lib/seed";

// The join link (CLAUDE.md §6): one per hisaab, grants write. A device with no
// identity yet sees only that hisaab's roster to pick from — never every
// person in the app. A device that's already signed in just gets added to the
// roster (if not already on it) and dropped straight into the ledger.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ hisaabId: string }>;
}) {
  const { hisaabId } = await params;
  return (
    <Book
      seed={{ entries, people, hisaabs, members }}
      joinHisaabId={hisaabId}
    />
  );
}
