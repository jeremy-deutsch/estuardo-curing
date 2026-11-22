import Link from "next/link";
import { fullName, type Voter } from "@/lib/types";
import { Icon } from "./icon";
import styles from "./voter-notes-link.module.css";

export function VoterNotesLink({ voter }: { voter: Voter }) {
  return (
    <Link
      href={`/notes?voter=${voter.id}`}
      className={styles.notesLink}
      title="View voter notes"
      aria-label={`View notes for ${fullName(voter)}`}
    >
      <Icon name="notes" />
    </Link>
  );
}
