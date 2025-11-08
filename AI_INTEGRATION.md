# AI Integration Guide

## Overview

SmartChart now features full AI-powered chart modification using Google's Gemini AI. Users can modify charts using natural language in the chat interface.

## Setup

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key

2. **Configure Environment**:
   ```bash
   # Copy the example env file
   copy .env.example .env  # Windows
   cp .env.example .env    # Mac/Linux
   ```

3. **Add Your API Key to `.env`**:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Start the App**:
   ```bash
   npm run dev
   ```

## How It Works

### Architecture

```
User Message (Chat)
    ↓
Gemini API Service (src/lib/gemini.ts)
    ↓
Current Config + User Request → Gemini AI
    ↓
New Configuration (JSON)
    ↓
Chart Updates Automatically
```

### Data Flow

1. **Chart Configuration** is managed in [App.tsx](src/App.tsx)
2. **Configuration Structure**:
   - `data`: Chart data points, axis keys, series names
   - `styling`: Chart type, colors, labels, visibility

3. **ChatPanel** sends requests to Gemini API
4. **Gemini** analyzes and returns updated configuration
5. **ChartPanel** re-renders with new configuration

## Example Commands

Try these natural language commands in the chat:

### Chart Type Changes
- "Change to a line chart"
- "Make it a bar chart"
- "Use combined chart with bars and lines"

### Data Modifications
- "Add more data points for Q1 and Q2"
- "Increase Product A values by 20%"
- "Show annual data instead of quarterly"

### Styling Changes
- "Change the colors to blue and green"
- "Hide Product C from the chart"
- "Show data labels on all bars"
- "Change the title to 'Annual Revenue'"

### Multiple Changes
- "Convert to line chart and change colors to pastel tones"
- "Hide Product D and show data labels"
- "Make it a combined chart with Product A as line and others as bars"

## Key Files

### Type Definitions
**[src/types/chart.ts](src/types/chart.ts)**
- `ChartConfiguration`: Main config interface (data + styling)
- `ChartData`: Data points, axis keys, series names
- `ChartStyling`: Visual properties (colors, type, labels)

### Gemini API Service
**[src/lib/gemini.ts](src/lib/gemini.ts)**
- `modifyChart()`: Main function that processes user requests
- Sends current config + user message to Gemini
- Receives and validates JSON response
- Returns updated configuration or error

### Components

**[src/App.tsx](src/App.tsx)**
- Manages shared chart configuration state
- Passes config to both ChartPanel and ChatPanel

**[src/components/ChartPanel.tsx](src/components/ChartPanel.tsx)**
- Renders chart based on configuration
- Manual controls update configuration
- Supports bar, line, and combined charts

**[src/components/ChatPanel.tsx](src/components/ChatPanel.tsx)**
- Chat interface with AI assistant
- Loading states with spinner
- Error handling with retry button
- Auto-scrolls to latest message

## Premium UX Features

### Loading State
- Animated spinner when AI is processing
- "Analyzing your request..." message
- Disabled input during processing
- Loading icon in send button

### Error Handling
- Red error messages with icon
- Clear error descriptions
- Retry button for failed requests
- Graceful fallback for missing API key

### Success Feedback
- AI explains what changed
- Smooth chart transitions
- Message history preserved
- Suggested prompts for new users

## Customization

### Modifying AI Behavior

Edit the prompt in [src/lib/gemini.ts](src/lib/gemini.ts):

```typescript
const prompt = `You are a chart configuration expert...`
```

You can:
- Adjust tone and personality
- Add domain-specific knowledge
- Change color palette preferences
- Customize response format

### Adding New Chart Types

1. Update [src/types/chart.ts](src/types/chart.ts):
   ```typescript
   export type ChartType = 'bar' | 'line' | 'combined' | 'pie' | 'area'
   ```

2. Add rendering logic in [ChartPanel.tsx](src/components/ChartPanel.tsx)

3. Update Gemini prompt to understand new types

### Extending Data Structure

To support additional data properties:

1. Extend `ChartDataPoint` interface
2. Update initial config in App.tsx
3. Modify chart rendering logic
4. Update Gemini prompt with new capabilities

## Troubleshooting

### "API key not configured"
- Check `.env` file exists in project root
- Verify `VITE_GEMINI_API_KEY` is set
- Restart dev server after adding key

### "Failed to parse AI response"
- Gemini might return unexpected format
- Check console for raw response
- Retry the request
- Simplify your prompt

### Chart doesn't update
- Check browser console for errors
- Verify configuration structure
- Ensure series names match data keys
- Check for TypeScript type errors

### Slow responses
- Gemini API latency varies
- Loading state shows processing
- Complex requests take longer
- Consider caching common requests

## Best Practices

1. **Be Specific**: "Change to line chart" works better than "make it different"

2. **One Change at a Time**: Better AI accuracy with focused requests

3. **Use Suggested Prompts**: Great starting points for new users

4. **Verify Changes**: Check chart matches your expectations

5. **Retry if Needed**: AI can make mistakes, retry button helps

## Future Enhancements

Potential improvements:
- [ ] Conversation history for context
- [ ] Chart templates ("Make it like a dashboard")
- [ ] Export configuration as JSON
- [ ] Import data from CSV/Excel
- [ ] Multi-step chart building wizard
- [ ] Voice input for hands-free operation
- [ ] Undo/redo functionality
- [ ] Configuration presets

## API Costs

Gemini API pricing (as of 2024):
- **gemini-1.5-flash**: Free tier available
- Very low cost for hobby projects
- Monitor usage in Google Cloud Console

For production:
- Implement rate limiting
- Add user authentication
- Cache common responses
- Consider OpenAI as alternative

## Security Notes

- API key stored in `.env` (not committed to git)
- Frontend calls API directly (consider backend proxy for production)
- Validate all AI responses before applying
- Sanitize user inputs
- Rate limit requests to prevent abuse

---

**Need help?** Check the main [README.md](./README.md) or [knowledge.md](./knowledge.md) for more details.
