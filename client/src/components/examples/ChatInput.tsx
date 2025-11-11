import ChatInput from '../ChatInput';

export default function ChatInputExample() {
  return (
    <ChatInput
      onSubmit={(question) => console.log('Question submitted:', question)}
      disabled={false}
    />
  );
}
