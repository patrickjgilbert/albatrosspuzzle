# Albatross Riddle Game - Design Guidelines

## Design Approach

**Hybrid Approach**: Chat applications like Discord, Telegram, and Linear for functional patterns, enhanced with atmospheric puzzle game elements from mystery/detective games. Balance clean chat usability with immersive, mysterious aesthetics.

**Core Principles**:
- Clarity in chaos: Despite dark theme, maintain excellent readability
- Focused engagement: Minimize distractions, center on puzzle-solving
- Progressive revelation: UI should support discovery journey
- Conversational intimacy: Chat feels personal, not clinical

---

## Typography

**Font Stack**:
- Primary: Inter or 'SF Pro Display' for clean, modern readability
- Monospace: 'JetBrains Mono' for puzzle statement (creates mystery/seriousness)

**Hierarchy**:
- Puzzle Statement: text-lg md:text-xl, font-medium, monospace
- Player Questions: text-base, font-normal
- System Responses: text-base, font-medium (distinguish from questions)
- UI Labels: text-sm, font-medium, uppercase tracking-wide
- Helper Text: text-xs, opacity-70

---

## Layout System

**Spacing Units**: Use Tailwind's 4, 6, 8, 12, 16, 24 for consistent rhythm

**Structure**:
```
Full-height viewport (h-screen) split:
- Header: fixed top, h-16 (game title, reset button)
- Main Chat Area: flex-1, overflow scroll
- Input Area: fixed bottom, h-20 to h-24
```

**Chat Container**:
- Max-width: max-w-3xl mx-auto (optimal reading width)
- Padding: px-4 md:px-6
- Messages: space-y-4 for breathing room between exchanges

---

## Component Library

### Header
- Fixed position with subtle border-bottom
- Left: "The Albatross Puzzle" title (text-lg font-semibold)
- Right: Reset/New Game button (secondary style)
- Center (optional): Progress indicator showing key discoveries

### Puzzle Statement Box
- Appears at chat start, pinned or as first message
- Background: Subtle elevated surface (distinct from messages)
- Border: Left accent border (border-l-4)
- Padding: p-6
- Typography: Monospace, slightly larger than chat
- Icon: Small skull or question mark icon top-right

### Chat Messages

**Player Questions**:
- Align right (ml-auto)
- Max-width: max-w-md
- Rounded corners: rounded-2xl rounded-br-sm (speech bubble)
- Padding: px-4 py-3
- Subtle elevated background

**System Responses**:
- Align left (mr-auto)
- Max-width: max-w-md
- Rounded corners: rounded-2xl rounded-bl-sm
- Padding: px-4 py-3
- Distinct background from questions
- Response badges: "YES", "NO", "DOES NOT MATTER" with small pills/badges (text-xs font-bold px-2 py-1 rounded-full)

**Key Discovery Messages**:
- When player uncovers major plot points
- Full-width with special styling
- Icon indicator (lightbulb or star)
- Subtle glow or border treatment

### Input Area
- Fixed bottom with backdrop blur
- Border-top separator
- Flex layout: Input field (flex-1) + Send button
- Input: Large touch target (h-12), rounded-full, px-6
- Placeholder: "Ask a yes/no question..."
- Send button: Icon only (paper plane), rounded-full, w-12 h-12

### Hints/Help System
- Floating button bottom-right (before input area)
- Opens modal or dropdown with sample questions
- Dismissible with smooth transition

### Game Completion Modal
- Center overlay with backdrop
- Celebration message
- Summary of key discoveries checked off
- "Play Again" primary button
- Confetti or subtle particle effect

---

## Interaction Patterns

**Message Appearance**:
- Slide-in from appropriate side (right for player, left for system)
- Duration: 300ms ease-out
- Slight fade-in combined with slide

**Typing Indicator**:
- Show when system is "thinking"
- Three animated dots bouncing
- Positioned where next message will appear

**Scroll Behavior**:
- Auto-scroll to latest message
- Smooth scroll (scroll-behavior: smooth)
- Sticky scroll when new messages arrive

**Input Focus**:
- Auto-focus on page load and after sending
- Clear input after successful send
- Subtle ring on focus (ring-2)

---

## Images

**No large hero images** - This is a chat-focused interface where content is king.

**Small Atmospheric Elements**:
- Header logo/icon: Stylized albatross silhouette (32x32px, subtle)
- Empty state: When no questions asked yet, small centered illustration of albatross or ship (200x200px, faded)
- Completion state: Small success icon in modal

Keep imagery minimal to maintain focus on conversation.

---

## Accessibility

- High contrast text ratios (WCAG AA minimum)
- Focus indicators on all interactive elements (ring-2 ring-offset-2)
- Keyboard navigation: Enter to send, Escape to close modals
- ARIA labels on icon-only buttons
- Screen reader announcements for new messages
- Semantic HTML: <main>, <header>, <form> for input

---

## Responsive Behavior

**Mobile (< 768px)**:
- Single column, full width messages (max-w-full)
- Reduce padding: px-3, py-2
- Stack header items if needed
- Larger touch targets (min h-12)

**Desktop (≥ 768px)**:
- Centered chat container (max-w-3xl)
- Hover states on buttons
- Keyboard shortcuts visible