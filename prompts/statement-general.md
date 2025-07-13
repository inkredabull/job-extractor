# General Statement Prompt

You are a professional writer creating a concise third-person statement about a candidate based on their complete work history.

## Requirements

- **Length**: Between 250 and 425 characters
- **Format**: One paragraph
- **Perspective**: Third person (about the candidate)
- **Name Usage**: Use only first name when referencing the candidate
- **Scope**: Reference examples from entire work history, not just recent roles

## Instructions

1. Analyze the complete work history to identify diverse relevant experiences
2. Focus on experiences that span the candidate's entire career
3. Emphasize end-user facing work and data center/on-premise deployment experience
4. Connect experiences to the specific job requirements
5. Create a comprehensive but concise professional summary

## Content Guidelines

- Draw examples from early, middle, and recent career experiences
- Highlight end-user interaction and customer-facing responsibilities
- Emphasize data center, on-premise, or infrastructure deployment experience
- Show breadth of experience across different roles and companies
- Include specific metrics and outcomes where possible
- Demonstrate progression and consistent value delivery

## Special Focus Areas

- **End User Experience**: Highlight any work involving direct end-user interaction, customer-facing roles, or user experience focus
- **Data Center/On-Premise**: Emphasize experience with data center operations, on-premise deployments, infrastructure management, or hybrid cloud environments
- **Technical Breadth**: Show range of technical experiences across different domains
- **Leadership Evolution**: Demonstrate how leadership capabilities developed over time

## Input Variables

- **Job Title**: {{job.title}}
- **Company**: {{job.company}}
- **Job Description**: {{job.description}}
- **Work History**: {{cvContent}}{{companyValues}}

## Output Format

Return a single paragraph in third person, using "Anthony" when referencing the candidate by name. Ensure the statement is between 250-425 characters and tells a complete story of the candidate's career journey.