import { describe, expect, it } from "bun:test";
import {
  messageAuthorJids,
  messageEditSenderCandidates,
} from "./messageEditSenders";

const ME = { id: "5511999990001:12@s.whatsapp.net", lid: "20000000000002@lid" };

describe("messageAuthorJids", () => {
  it("gives both addressing forms of an incoming author, LID first", () => {
    expect(
      messageAuthorJids(
        {
          remoteJid: "100000000000001@lid",
          remoteJidAlt: "553499990001@s.whatsapp.net",
          fromMe: false,
          id: "x",
        },
        ME,
      ),
    ).toEqual(["100000000000001@lid", "553499990001@s.whatsapp.net"]);
  });

  it("prefers the participant in a group", () => {
    expect(
      messageAuthorJids(
        {
          remoteJid: "120363000000000000@g.us",
          participant: "100000000000001@lid",
          participantAlt: "553499990001@s.whatsapp.net",
          fromMe: false,
          id: "x",
        },
        ME,
      ),
    ).toEqual(["100000000000001@lid", "553499990001@s.whatsapp.net"]);
  });

  it("answers with our own JIDs for our own message", () => {
    expect(
      messageAuthorJids(
        { remoteJid: "100000000000001@lid", fromMe: true, id: "x" },
        ME,
      ),
    ).toEqual(["20000000000002@lid", "5511999990001@s.whatsapp.net"]);
  });

  // The device suffix is per-session and never part of the derivation.
  it("strips the device suffix", () => {
    expect(
      messageAuthorJids(
        { remoteJid: "100000000000001:58@lid", fromMe: false, id: "x" },
        ME,
      ),
    ).toEqual(["100000000000001@lid"]);
  });

  it("drops duplicates and blanks", () => {
    expect(
      messageAuthorJids(
        {
          remoteJid: "100000000000001@lid",
          remoteJidAlt: "100000000000001@lid",
          participant: "",
          fromMe: false,
          id: "x",
        },
        ME,
      ),
    ).toEqual(["100000000000001@lid"]);
  });
});

describe("messageEditSenderCandidates", () => {
  const editKey = {
    remoteJid: "100000000000001@lid",
    remoteJidAlt: "553499990001@s.whatsapp.net",
    fromMe: false,
    id: "edit-1",
  };

  // The observed shape: the contact edits their own message, so
  // targetMessageKey.fromMe is true from THEIR point of view and the original
  // author is the editor.
  it("makes the editor the original author when the target is theirs", () => {
    expect(
      messageEditSenderCandidates({
        editKey,
        targetKey: {
          remoteJid: "20000000000002@lid",
          fromMe: true,
          id: "orig-1",
        },
        me: ME,
      }),
    ).toEqual([
      {
        origMsgSender: "100000000000001@lid",
        editSender: "100000000000001@lid",
      },
      {
        origMsgSender: "100000000000001@lid",
        editSender: "553499990001@s.whatsapp.net",
      },
      {
        origMsgSender: "553499990001@s.whatsapp.net",
        editSender: "100000000000001@lid",
      },
      {
        origMsgSender: "553499990001@s.whatsapp.net",
        editSender: "553499990001@s.whatsapp.net",
      },
    ]);
  });

  // fromMe false means they are editing OUR message, and the key's remoteJid is
  // then how they address us — which is not a JID we would otherwise guess.
  it("takes the original author from the target key when it is not theirs", () => {
    const candidates = messageEditSenderCandidates({
      editKey,
      targetKey: { remoteJid: "20000000000002@lid", fromMe: false, id: "o" },
      me: ME,
    });

    expect(candidates.map((c) => c.origMsgSender)).toEqual([
      "20000000000002@lid",
      "20000000000002@lid",
    ]);
  });

  // The fallback for a JID form the reasoning above did not predict: whoever we
  // actually filed the original under.
  it("appends the stored authors after the derived one", () => {
    const candidates = messageEditSenderCandidates({
      editKey,
      targetKey: { remoteJid: "20000000000002@lid", fromMe: false, id: "o" },
      me: ME,
      storedSenders: ["100000000000001@lid"],
    });

    expect(candidates.map((c) => c.origMsgSender)).toEqual([
      "20000000000002@lid",
      "20000000000002@lid",
      "100000000000001@lid",
      "100000000000001@lid",
    ]);
  });

  it("does not repeat a stored author already derived", () => {
    const candidates = messageEditSenderCandidates({
      editKey,
      targetKey: { remoteJid: "20000000000002@lid", fromMe: false, id: "o" },
      me: ME,
      storedSenders: ["20000000000002@lid"],
    });

    expect(candidates).toHaveLength(2);
  });
});
