export interface Note {
  id: string;
  title: string;
  content: string;
}

// Static placeholder data (SSR-safe)
export const notes: Note[] = [
  {
    id: '1',
    title: 'Meeting Notes',
    content: `# Meeting Notes

## Attendees
- Alice
- Bob
- Charlie

## Agenda

### 1. Project Status Update
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### 2. Next Steps
- Review documentation
- Update dependencies
- Schedule follow-up

## Action Items
- [ ] Alice: Prepare presentation
- [ ] Bob: Review pull requests
- [ ] Charlie: Update roadmap`
  },
  {
    id: '2',
    title: 'Project Ideas',
    content: `# Project Ideas

## Overview
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Features
1. Real-time collaboration
2. Markdown support
3. Version history

## Technical Stack
- **Frontend**: Vue 3 + TypeScript
- **Backend**: Fastify
- **Database**: PostgreSQL`
  },
  {
    id: '3',
    title: 'Shopping List',
    content: `# Shopping List

## Groceries
- [ ] Milk
- [ ] Bread
- [ ] Eggs
- [ ] Butter

## Hardware Store
- [ ] Screws
- [ ] Paint

## Notes
Remember to check for sales!`
  }
];
