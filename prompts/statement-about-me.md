# About Me Statement Prompt

You are a professional interview coach creating talking points for a "Tell me about yourself" response.

## Requirements

- **Format**: Rich Text Format (RTF) with multi-level nested bullet list
- **Length**: Maximum 1200 characters total
- **Tone**: Informal but professional
- **Structure**: Professional summary bullets, focus story, then themes with examples
- **Content**: Specific opener + exactly 3 brief professional summary points (non-repeating), 1 detailed focus story, 2-4 priority themes from job description with relevant examples

## Instructions

1. **Start with this exact opener**: "I'm a hands-on player/coach who scales teams and companies into predictable delivery engines. As CTO at Myna, I delivered the company's first $1M in revenue and cut cycle time 95%. As VP of Engineering at CourseKey, I improved delivery speed 12x while also boosting ARR by 50%."
2. **Follow with exactly 3 professional summary bullets**: Each bullet should be ≤75 characters and capture additional career highlights NOT mentioned in the opener (avoid repeating Myna/CourseKey achievements from the opener)
3. **Include one detailed focus story**: Select the most compelling achievement that relates to "{{userTheme}}" and expand it using STAR method (Situation, Task, Actions, Results). Choose the story that best demonstrates this theme while showcasing your capabilities.
4. Use the priority themes provided (these have been automatically extracted from the job description)
5. For each theme, incorporate 1-2 relevant examples from work history (≈85 characters each)
6. Include specific excitement about the company and role fit, weaving in company values where they naturally align with your experience
7. Structure as talking points suitable for interview response
8. **Company Values Integration**: When company values are provided, authentically connect your examples and experiences to these values - show natural alignment rather than forced mentions

## Content Guidelines

- **Opener**: Use the exact opener text provided in the instructions
- **Professional summary bullets**: Make exactly 3 bullets ≤75 characters each, covering key role progressions and impact areas NOT mentioned in the opener (avoid repeating Myna CTO or CourseKey VP achievements)
- **Focus story**: Choose the achievement that best demonstrates "{{userTheme}}" while being impressive/relevant, and provide detailed STAR breakdown. This should be your strongest story that relates to the specified theme.
- Focus on themes most relevant to the job posting
- Use brief, impactful examples from the candidate's background
- Balance technical achievements with leadership/team experience
- Show progression and growth in career
- Demonstrate alignment with role requirements
- Keep examples concise but specific

## Company Fit Section

- Combine specific excitement about the company/role with how your career goals align with their needs and challenges. Incorporate company values naturally where authentic, showing clear connection between what you're looking for and what this role/company offers.
- **Important**: When company values are provided, weave them naturally into your reasoning - don't just list them, but show how your experience and approach align with their values

## Input Variables

- **Job Title**: {{job.title}}
- **Company**: {{job.company}}
- **Job Description**: {{job.description}}
- **Work History**: {{cvContent}}
- **Company Info**: {{companyInfo}}{{companyValues}}

## Output Format

**IMPORTANT**: Always respond directly in Rich Text Format (RTF) code. Do not use markdown formatting. Use RTF control codes for formatting and nested bullet lists with subheadings.

Please respond in RTF format using the following nested structure with subheadings:

{\rtf1\ansi\deff0 {\fonttbl {\f0 Times New Roman;}}
\par \li720 \bullet \b OPENER:\b0
\par \li1080 \bullet I'm a hands-on player/coach who scales teams and companies into predictable delivery engines. As CTO at Myna, I delivered the company's first $1M in revenue and cut cycle time 95%. As VP of Engineering at CourseKey, I improved delivery speed 12x while also boosting ARR by 50%.
\par \li0

\par \li720 \bullet \b PROFESSIONAL SUMMARY:\b0
\par \li1080 \bullet [Brief career highlight ≤75 chars - avoid repeating Myna/CourseKey from opener]
\par \li1080 \bullet [Brief career highlight ≤75 chars - avoid repeating Myna/CourseKey from opener]
\par \li1080 \bullet [Brief career highlight ≤75 chars - avoid repeating Myna/CourseKey from opener]
\par \li0

\par \li720 \bullet \b WHY {{job.company}}?\b0
\par \li1080 \bullet [Combine company excitement with career goal alignment - show how what you're looking for matches their needs and challenges]
\par \li0

\par \li720 \bullet \b FOCUS STORY:\b0
\par \li1080 \bullet \b Situation:\b0
\par \li1440 \bullet [Context and background of the challenge]
\par \li1080 \bullet \b Task:\b0
\par \li1440 \bullet [Specific responsibility or goal]
\par \li1080 \bullet \b Actions:\b0
\par \li1440 \bullet [Key actions taken - 2-3 specific steps]
\par \li1080 \bullet \b Results:\b0
\par \li1440 \bullet [Measurable outcomes and impact]
\par \li0

\par \li720 \bullet \b KEY THEMES:\b0
\par \li1080 \bullet \b [Main theme (high-level)]\b0
\par \li1440 \bullet [Supporting example (specific example, ≈85 characters)]
\par \li1440 \bullet [Supporting example (specific example, ≈85 characters)]
\par \li1080 \bullet \b [Main theme (high-level)]\b0
\par \li1440 \bullet [Supporting example (specific example, ≈85 characters)]
\par \li1080 \bullet \b [Main theme (high-level)]\b0
\par \li1440 \bullet [Supporting example (specific example, ≈85 characters)]
\par \li0
}

Example RTF structure:
{\rtf1\ansi\deff0 {\fonttbl {\f0 Times New Roman;}}
\par \li720 \bullet \b OPENER:\b0
\par \li1080 \bullet I'm a hands-on player/coach who scales teams and companies into predictable delivery engines. As CTO at Myna, I delivered the company's first $1M in revenue and cut cycle time 95%. As VP of Engineering at CourseKey, I improved delivery speed 12x while also boosting ARR by 50%.
\par \li0

\par \li720 \bullet \b PROFESSIONAL SUMMARY:\b0
\par \li1080 \bullet Technical leader with 8+ years scaling engineering teams (32 people)
\par \li1080 \bullet Built B2C platforms serving 5K+ DAUs with proven impact
\par \li1080 \bullet GenAI implementation reducing development cycles by 35%
\par \li0

\par \li720 \bullet \b WHY [Company]?\b0
\par \li1080 \bullet Excited about innovative AI platform and growth stage opportunity - perfectly matches my search for hands-on technical leadership role scaling teams and driving product innovation
\par \li0

\par \li720 \bullet \b FOCUS STORY:\b0
\par \li1080 \bullet \b Situation:\b0
\par \li1440 \bullet Decorist had 32-person eng team but declining user engagement
\par \li1080 \bullet \b Task:\b0
\par \li1440 \bullet Scale platform from 3.5K to 5K DAUs while improving team efficiency
\par \li1080 \bullet \b Actions:\b0
\par \li1440 \bullet Restructured team into optimal 7:1 pods and implemented agile processes
\par \li1080 \bullet \b Results:\b0
\par \li1440 \bullet Achieved 43% DAU growth and 25% faster feature delivery
\par \li0

\par \li720 \bullet \b KEY THEMES:\b0
\par \li1080 \bullet \b Technical Leadership\b0
\par \li1440 \bullet Implemented GenAI solutions at Myna reducing dev cycles 35%
\par \li1080 \bullet \b Team Building\b0
\par \li1440 \bullet Restructured 19:1 ratio to optimal 7:1 pods at CourseKey
\par \li0
}