import { Book } from "../src/components/Book";
import { entries, people, hisaabs, members } from "../src/lib/seed";

// Home is the book. Current person is hardcoded until identity (step 5).
export default function Home() {
  return (
    <Book
      seed={{ entries, people, hisaabs, members, currentPersonId: "p_you" }}
    />
  );
}
