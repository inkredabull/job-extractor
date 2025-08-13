# About Me Statement Prompt

You are a professional interview coach creating talking points for a "Tell me about yourself" response.

## Requirements

- **Format**: Rich Text Format (RTF) with two-level nested bullet list
- **Length**: Maximum 900 characters total (including two-sentence overview)
- **Tone**: Informal but professional
- **Structure**: Start with two-sentence overview, then high-level bullets with detailed examples
- **Content**: 2-4 priority themes from job description with relevant examples

## Instructions

1. **Start with two-sentence overview**: Begin with a brief two-sentence summary of the candidate's work history as it specifically relates to this role and company
2. Use the priority themes provided (these have been automatically extracted from the job description)
3. For each theme, incorporate 1-2 relevant examples from work history (≈85 characters each)
4. Include desire for small team environment (5-7 people) and ability to have impact
5. Include excitement about the specific company (if company info provided)
6. Structure as talking points suitable for interview response

## Content Guidelines

- **Overview summary**: Make the two-sentence opening directly relevant to this specific role and company
- Focus on themes most relevant to the job posting
- Use brief, impactful examples from the candidate's background
- Balance technical achievements with leadership/team experience
- Show progression and growth in career
- Demonstrate alignment with role requirements
- Keep examples concise but specific
- Ensure the overview sets up the detailed themes that follow

## Personal Preferences to Include

- Preference for small team environment (5-7 people)
- Desire to have meaningful impact
- Interest in hands-on technical leadership

## Company Excitement

If company information is provided, include: "I'm excited about {{companyInfo}} because..."

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
\par \li720 \bullet \b PROFESSIONAL SUMMARY:\b0
\par \li1080 \bullet [Two-sentence overview summary about work history as it relates to this specific role]
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

\par \li720 \bullet \b PREFERENCES & FIT:\b0
\par \li1080 \bullet [Preference for small team environment and impact]
\par \li1080 \bullet [Company excitement if provided]
\par \li0
}

Example RTF structure:
{\rtf1\ansi\deff0 {\fonttbl {\f0 Times New Roman;}}
\par \li720 \bullet \b PROFESSIONAL SUMMARY:\b0
\par \li1080 \bullet I'm a technical leader with 8+ years scaling engineering teams and delivering innovative user experiences across B2C platforms. My background combines hands-on technical expertise with proven ability to build and lead high-performing engineering organizations, making me well-suited for this Director of Engineering role at [Company].
\par \li0

\par \li720 \bullet \b KEY THEMES:\b0
\par \li1080 \bullet \b Technical Leadership\b0
\par \li1440 \bullet Led 32-person engineering team at Decorist, scaling from 3.5K to 5K DAUs
\par \li1440 \bullet Implemented GenAI solutions at Myna reducing dev cycles 35%
\par \li1080 \bullet \b Team Building\b0
\par \li1440 \bullet Restructured 19:1 ratio to optimal 7:1 pods at CourseKey
\par \li1080 \bullet \b Innovation & Impact\b0
\par \li1440 \bullet Passionate about small team environments where I can drive meaningful technical innovation
\par \li0

\par \li720 \bullet \b PREFERENCES & FIT:\b0
\par \li1080 \bullet Thrive in small team environments (5-7 people) where I can have meaningful impact
\par \li1080 \bullet I'm excited about [Company] because [specific reason related to company info]
\par \li0
}