import ChatMessage from '../ChatMessage';

export default function ChatMessageExample() {
  return (
    <div className="space-y-4 p-4">
      <ChatMessage type="player" content="Did the man have a family?" />
      <ChatMessage type="system" content="Yes, he had a wife and children." response="YES" />
      <ChatMessage type="player" content="Was the man caucasian?" />
      <ChatMessage type="system" content="This detail is not relevant to solving the puzzle." response="DOES NOT MATTER" />
      <ChatMessage type="discovery" content="Key Discovery: The man was on a ship!" isDiscovery />
    </div>
  );
}
