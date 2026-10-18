// backend/prisma/seed-data/posts.js
// Post corpus for the community feed.
//
// Every template is a function of a context object built from the author's
// real profile, so a Qualcomm ECE alumnus writes about chipsets and an IT
// student writes about React — not interchangeable filler.
//
// ctx fields: name, firstName, role, dept, deptName, year, company, otherCompany,
//             designation, domain, scale, skill, skill2, skill3, focus, n, mentorName

'use strict';

// ─── Alumni: work, hiring, advice, career moves ──────────────────────────────

const ALUMNI_TEMPLATES = [
  (c) => ({
    content: `Three years into working on ${c.domain} at ${c.company}, the thing that surprised me most:\n\nNobody cares how clever your code is. They care whether the next person can change it safely. I write far more boring ${c.skill} now than I did as a fresher, and the systems are far more reliable for it.`,
    tags: ['engineering', 'career', 'advice'],
  }),
  (c) => ({
    content: `${c.company} is hiring ${c.designation}s — ${c.year + 2} batch onwards.\n\nWhat the loop actually tests:\n• ${c.skill} depth, not breadth\n• Whether you can debug out loud\n• One project you genuinely own\n\nI can put in referrals. Comment your area and I'll reach out.`,
    tags: ['hiring', 'referral', 'opportunity'],
  }),
  (c) => ({
    content: `We hit an interesting problem at ${c.company} this week. Our ${c.skill} layer was fine in isolation but fell over under ${c.scale}.\n\nRoot cause wasn't the code — it was an assumption nobody had written down. Lesson for students: document your assumptions, they outlive your code.`,
    tags: ['engineering', 'systemdesign', 'learning'],
  }),
  (c) => ({
    content: `Reviewed around ${c.n} resumes from our college this placement season. The same fixes keep coming up:\n\n1. "Built X using ${c.skill}" → "Built X that reduced Y by Z%"\n2. Drop the skills you'd panic about in an interview\n3. One page, genuinely\n\nHappy to review yours — just message me.`,
    tags: ['resume', 'placement', 'advice'],
  }),
  (c) => ({
    content: `Moved from ${c.otherCompany} to ${c.company} as ${c.designation} this month.\n\nBiggest thing I'd tell my final-year self: your first company matters much less than your first manager. Optimise for someone who reviews your work honestly, not for the brand on your offer letter.`,
    tags: ['career', 'reflection', 'advice'],
  }),
  (c) => ({
    content: `Working on ${c.domain} means dealing with ${c.scale}. The interview question I now ask candidates:\n\n"Your service is at 99.9%. Business wants 99.99%. What's your first move?"\n\nBest answer I've heard: "Measure where the 0.1% actually goes." Start with data, not architecture diagrams.`,
    tags: ['interview', 'systemdesign', 'engineering'],
  }),
  (c) => ({
    content: `SSN ${c.dept} ${c.year} here, now ${c.designation} at ${c.company}.\n\nFor anyone in ${c.deptName} wondering whether our branch limits you — it doesn't. ${c.skill} and ${c.skill2} are learnable. What's hard to learn later is the habit of finishing what you start.`,
    tags: ['career', 'advice', 'alumni'],
  }),
  (c) => ({
    content: `Mentorship update: finished a ${c.focus} track with ${c.n > 6 ? 4 : 3} students from our college this semester. All of them now have internships.\n\nOpening two more slots. Request mentorship if you're willing to commit weekly — I'd rather have two serious students than ten casual ones.`,
    tags: ['mentorship', 'students', 'opportunity'],
  }),
  (c) => ({
    content: `Honest take on ${c.skill} certifications: in my years at ${c.company}, I have never been asked about one.\n\nI have been asked, in every single interview, to explain something I built and why I made the tradeoffs I did. Build the thing. The certificate is optional.`,
    tags: ['advice', 'career', 'opinion'],
  }),
  (c) => ({
    content: `Higher studies vs placement — I get this question weekly.\n\nI took the job at ${c.company} first, then did my MS part-time. Work experience made my application stronger, not weaker. It's not a one-way door, so stop treating the decision like it is.`,
    tags: ['higherstudies', 'career', 'advice'],
  }),
  (c) => ({
    content: `Our team is opening ${c.n > 30 ? 3 : 2} internship slots for the ${c.year + 4} batch.\n\nStack: ${c.skill}, ${c.skill2}. Prior experience genuinely not required — we care that you can learn in public and ask specific questions instead of vague ones.\n\nCollege referrals get looked at first.`,
    tags: ['internship', 'hiring', 'referral'],
  }),
  (c) => ({
    content: `Debugging story from ${c.company}. Spent two days on a ${c.skill} issue that turned out to be a timezone assumption from 2019.\n\nIf you're a student: learning to read a stack trace properly is worth more than three more tutorials. Read the error. Then read it again.`,
    tags: ['debugging', 'engineering', 'learning'],
  }),
  (c) => ({
    content: `Hosting an informal AMA this weekend for ${c.deptName} students — ${c.focus}, placements, or what the work is actually like at a company doing ${c.domain}.\n\nNo slides. Bring real questions. Comment and I'll share the link.`,
    tags: ['ama', 'mentorship', 'event'],
  }),
  (c) => ({
    content: `Promoted to ${c.designation} at ${c.company} this quarter 🎉\n\nWhat moved the needle wasn't ${c.skill} skill — it was writing design docs other engineers could follow. If you're in final year, practise explaining your project in one page. That skill compounds.`,
    tags: ['career', 'milestone', 'advice'],
  }),
  (c) => ({
    content: `${c.focus} prep, honestly:\n\n1. ${c.skill} — know it well enough to teach it\n2. ${c.skill2} — working familiarity is enough\n3. Practise saying "I don't know, but here's how I'd find out"\n\nThat third one has saved me in more interviews than any algorithm ever did.`,
    tags: ['interview', 'preparation', 'advice'],
  }),
  (c) => ({
    content: `Shipped a migration at ${c.company} that touched ${c.domain}. Two things worth passing on:\n\n• The database is always the hard part, never the application code\n• ${c.skill} made it tractable; observability made it survivable\n\nHappy to go deeper if you're studying distributed systems.`,
    tags: ['engineering', 'systemdesign', 'migration'],
  }),
  (c) => ({
    content: `To the ${c.year + 4} batch deciding between an offer and another prep season:\n\nTake the offer. Six months of shipping real code against ${c.scale} teaches more than six months of mock interviews. You can always switch later — most of us did.`,
    tags: ['career', 'placement', 'advice'],
  }),
  (c) => ({
    content: `Something I wish someone had told me in ${c.dept}:\n\nThe gap between a student project and production ${c.skill} isn't knowledge, it's failure handling. Your project works. Production code has to work when the network drops mid-request. Start thinking that way early.`,
    tags: ['engineering', 'advice', 'students'],
  }),
];

// ─── Students: progress, questions, wins, asks ───────────────────────────────

const STUDENT_TEMPLATES = [
  (c) => ({
    content: `Finally got my ${c.skill} project working after three weeks 😅\n\nThe bug was me misunderstanding how it actually works underneath, not the library. Would really value feedback from anyone working in ${c.focus}.`,
    tags: ['project', 'learning', 'students'],
  }),
  (c) => ({
    content: `Got my internship offer from ${c.company}! 🎉\n\nGenuine thanks to the seniors here who reviewed my resume and did mock interviews with me. If you're in ${c.dept} and haven't reached out to alumni yet — do it now, not in final year.`,
    tags: ['placement', 'internship', 'gratitude'],
  }),
  (c) => ({
    content: `Question for alumni working on ${c.focus}: how much ${c.skill} depth is actually expected at entry level?\n\nI'm comfortable with the basics but unsure whether to go deeper here or broaden into ${c.skill2}. Genuinely torn and would value a real opinion.`,
    tags: ['question', 'advice', 'placement'],
  }),
  (c) => ({
    content: `Day ${c.n} of learning ${c.skill}.\n\nToday it finally clicked why everyone insists on fundamentals first. Spent two days fighting something that was just me not understanding the model underneath. Slow progress is still progress.`,
    tags: ['learning', 'progress', 'students'],
  }),
  (c) => ({
    content: `Our ${c.dept} team placed in the top 10 at the inter-college hackathon 🏆\n\nBuilt a ${c.skill} based solution in 24 hours. Sleep deprived and slightly delirious but genuinely proud. Thanks to everyone who gave feedback on the idea beforehand.`,
    tags: ['hackathon', 'achievement', 'teamwork'],
  }),
  (c) => ({
    content: `Cleared the first two rounds at ${c.company}, final round next week 🤞\n\nFor anyone preparing: the ${c.skill} questions were far more practical than I expected. Less theory, more "here's a messy real situation, what do you actually do".`,
    tags: ['interview', 'placement', 'progress'],
  }),
  (c) => ({
    content: `Looking for a mentor in ${c.focus} 🙏\n\n${c.deptName}, ${c.year} batch. Comfortable with ${c.skill}, currently learning ${c.skill2}. I can commit consistent weekly work — I just need direction on what to prioritise first.`,
    tags: ['mentorship', 'request', 'students'],
  }),
  (c) => ({
    content: `First open source PR just got merged 🎉\n\nIt was a two-line docs fix, but reading a real ${c.skill} codebase taught me more than any tutorial has. Strongly recommend this to other ${c.dept} students — start smaller than you think.`,
    tags: ['opensource', 'learning', 'milestone'],
  }),
  (c) => ({
    content: `Does anyone from our college work at ${c.company}?\n\nI'm preparing for their ${c.focus} process and would really value 15 minutes to understand what they look for. Happy to work entirely around your schedule.`,
    tags: ['question', 'networking', 'placement'],
  }),
  (c) => ({
    content: `Finished a ${c.skill} course and immediately realised I can't build anything with it yet 😅\n\nStarting a small project this week to actually apply it. Note to juniors: courses give you vocabulary, projects give you skill. They are not the same thing.`,
    tags: ['learning', 'reflection', 'students'],
  }),
  (c) => ({
    content: `Presented my ${c.deptName} project review today and got thoroughly torn apart by the panel 😬\n\nHonestly, they were right — I hadn't validated my core assumption. Rebuilding the ${c.skill} module properly this time. Better to hear it now than in an interview.`,
    tags: ['project', 'learning', 'reflection'],
  }),
  (c) => ({
    content: `Study group forming for ${c.focus} prep — ${c.year} batch, any department.\n\nPlan: twice a week, work through ${c.skill} problems together, mock interview each other properly. Comment if you want in. Consistency over intensity.`,
    tags: ['studygroup', 'preparation', 'collaboration'],
  }),
  (c) => ({
    content: `Thank you ${c.mentorName} for the mentorship session on ${c.focus} 🙏\n\nOne line changed how I'm approaching this: "stop optimising your resume, start building things worth putting on it." Back to work.`,
    tags: ['mentorship', 'gratitude', 'advice'],
  }),
  (c) => ({
    content: `Built a small tool to automate part of my ${c.deptName} lab work using ${c.skill}.\n\nSaves about two hours a week. Nothing technically impressive, but it's the first time I've written code I actually use every day. That feels different.`,
    tags: ['project', 'automation', 'learning'],
  }),
  (c) => ({
    content: `Mini milestone: ${c.n} days consistent on ${c.skill2} fundamentals.\n\nNot chasing a number — I'm trying to actually recognise patterns rather than memorise solutions. Noticing a real difference in how I approach unfamiliar problems now.`,
    tags: ['progress', 'preparation', 'consistency'],
  }),
  (c) => ({
    content: `Switching my final year project direction from ${c.skill2} to ${c.skill} after talking to two alumni.\n\nTheir point was fair: build something in the area you actually want to work in, not the area that's easiest to demo. Starting over in week 6, slightly terrified.`,
    tags: ['project', 'decision', 'students'],
  }),
  (c) => ({
    content: `${c.deptName} students — does anyone have notes or resources for ${c.skill}?\n\nThe course material assumes background I don't have and I'd rather fix the gap properly than cram. Happy to share what I've collected so far in return.`,
    tags: ['question', 'resources', 'students'],
  }),
];

// ─── Campus-wide / departmental ──────────────────────────────────────────────

const CAMPUS_TEMPLATES = [
  (c) => ({
    content: `Reminder: ${c.deptName} placement drive registration closes Friday.\n\n${c.company} and several others are confirmed. Update your resume on the portal — people missed out on technicalities last year, which is a painful way to lose an opportunity.`,
    tags: ['placement', 'announcement', 'campus'],
  }),
  (c) => ({
    content: `Tech talk Thursday: "${c.focus} in practice", by an alumnus now working on ${c.domain} at ${c.company}.\n\nOpen to all departments and years. These sessions are where most people make their first real alumni connection — worth showing up.`,
    tags: ['event', 'techtalk', 'campus'],
  }),
  (c) => ({
    content: `Resource dump for ${c.focus} 📚\n\n• ${c.skill} — official docs beat every tutorial, genuinely\n• ${c.skill2} — build something small before reading more\n• Mock interviews with seniors here, early and often\n\nSave this.`,
    tags: ['resources', 'preparation', 'advice'],
  }),
  (c) => ({
    content: `Pattern after watching a few batches go through placements:\n\nThe students who do well aren't the ones with the highest CGPA. They're the ones who asked for help early and then acted on the feedback. It's visible from a mile away.`,
    tags: ['advice', 'placement', 'observation'],
  }),
  (c) => ({
    content: `Our ${c.deptName} alumni now work across ${c.company}, ${c.otherCompany} and dozens of others.\n\nIf you're a student who hasn't messaged a single senior yet, that's the easiest win available to you. Most of us genuinely want to help — we just can't read minds.`,
    tags: ['networking', 'alumni', 'campus'],
  }),
  (c) => ({
    content: `${c.deptName} project showcase this semester included solid work on ${c.skill} and ${c.skill2}.\n\nThe standard climbs every year. Juniors: go look at what your seniors actually built before you plan your own. Ambition calibrates.`,
    tags: ['projects', 'campus', 'showcase'],
  }),
];

// ─── Comments ────────────────────────────────────────────────────────────────

const COMMENT_TEMPLATES = [
  'This is genuinely useful, thank you for writing it out properly.',
  'Saving this. The second point is exactly what I keep getting wrong.',
  'Could you expand on the {skill} part? Not sure I follow the reasoning there.',
  'Congratulations! Well deserved 🎉',
  'Had almost exactly this experience last year. Holds up completely.',
  'Thanks for offering — sending you a message now.',
  'This is the realistic advice juniors actually need, not the usual generic stuff.',
  'Interested! {dept}, {year} batch, working with {skill} currently.',
  'Any chance you could share the resources you used for {skill}?',
  'Happy to help with this — I went through the same loop at {company}.',
  'Bookmarking, I am preparing for exactly this right now.',
  'The point about explaining your project end to end is underrated.',
  'How long did this take overall? Trying to plan my own timeline realistically.',
  'Thanks for the honesty. Most posts on this topic oversell things badly.',
  'Just sent a connection request — would love to hear more about your path.',
  'This answered something I have been sitting on for weeks. Appreciated.',
  'Solid advice. I would add that consistency matters more than intensity here.',
  'Can confirm — {skill} fundamentals came up in every single round for me.',
  'Following this. Same question from the {dept} side of things.',
  'Really good to see alumni engaging like this. It makes a difference.',
  'Does this hold for {dept} roles too, or is it mostly software specific?',
  'Tried this approach last month and it worked better than I expected.',
  'Sent you a connection request, hope that is alright!',
  'Thanks for being specific instead of just saying "work hard".',
];

module.exports = {
  ALUMNI_TEMPLATES, STUDENT_TEMPLATES, CAMPUS_TEMPLATES, COMMENT_TEMPLATES,
};
