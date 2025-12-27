import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * T217: Seed script for development data
 *
 * This mutation creates sample data for development and testing.
 * Run with: npx convex run seed:seedDatabase
 */
export const seedDatabase = mutation({
  args: {
    clearExisting: v.optional(v.boolean()),
  },
  returns: v.object({
    users: v.number(),
    teams: v.number(),
    courses: v.number(),
    sections: v.number(),
    lessons: v.number(),
  }),
  handler: async (ctx, args) => {
    // Optionally clear existing data
    if (args.clearExisting) {
      // Delete in reverse dependency order
      const tables = [
        "quizAttempts",
        "quizQuestions",
        "quizConfigs",
        "embedConfigs",
        "files",
        "progress",
        "comments",
        "messages",
        "conversationParticipants",
        "conversations",
        "activityLogs",
        "sessions",
        "courseAssignments",
        "courseTags",
        "lessons",
        "sections",
        "courses",
        "tags",
        "teamMembers",
        "teams",
        "users",
      ] as const;

      for (const table of tables) {
        const records = await ctx.db.query(table).collect();
        for (const record of records) {
          await ctx.db.delete(record._id);
        }
      }
    }

    const now = Date.now();
    const counts = {
      users: 0,
      teams: 0,
      courses: 0,
      sections: 0,
      lessons: 0,
    };

    // Create users
    const adminUser = await ctx.db.insert("users", {
      clerkId: "seed_admin_001",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      status: "online",
      lastActiveAt: now,
    });
    counts.users++;

    const users = [];
    const userNames = [
      { name: "Alice Johnson", email: "alice@example.com" },
      { name: "Bob Smith", email: "bob@example.com" },
      { name: "Carol Williams", email: "carol@example.com" },
      { name: "David Brown", email: "david@example.com" },
      { name: "Emma Davis", email: "emma@example.com" },
      { name: "Frank Miller", email: "frank@example.com" },
      { name: "Grace Wilson", email: "grace@example.com" },
      { name: "Henry Taylor", email: "henry@example.com" },
    ];

    for (let i = 0; i < userNames.length; i++) {
      const userData = userNames[i]!;
      const userId = await ctx.db.insert("users", {
        clerkId: `seed_user_${String(i + 1).padStart(3, "0")}`,
        email: userData.email,
        name: userData.name,
        role: "user",
        status: i < 3 ? "online" : "offline",
        lastActiveAt: now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
      });
      users.push(userId);
      counts.users++;
    }

    // Create teams
    const salesTeam = await ctx.db.insert("teams", {
      name: "Sales Team",
      description: "Business development representatives",
      leadId: users[0]!,
    });
    counts.teams++;

    const marketingTeam = await ctx.db.insert("teams", {
      name: "Marketing Team",
      description: "Marketing and growth team",
      leadId: users[3]!,
    });
    counts.teams++;

    const supportTeam = await ctx.db.insert("teams", {
      name: "Support Team",
      description: "Customer success and support",
      leadId: users[6]!,
    });
    counts.teams++;

    // Add members to teams
    await ctx.db.insert("teamMembers", {
      teamId: salesTeam,
      userId: users[0]!,
      joinedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      teamId: salesTeam,
      userId: users[1]!,
      joinedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      teamId: salesTeam,
      userId: users[2]!,
      joinedAt: now,
    });

    await ctx.db.insert("teamMembers", {
      teamId: marketingTeam,
      userId: users[3]!,
      joinedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      teamId: marketingTeam,
      userId: users[4]!,
      joinedAt: now,
    });

    await ctx.db.insert("teamMembers", {
      teamId: supportTeam,
      userId: users[5]!,
      joinedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      teamId: supportTeam,
      userId: users[6]!,
      joinedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      teamId: supportTeam,
      userId: users[7]!,
      joinedAt: now,
    });

    // Create tags
    const tagOnboarding = await ctx.db.insert("tags", { name: "Onboarding" });
    const tagSales = await ctx.db.insert("tags", { name: "Sales" });
    const tagProduct = await ctx.db.insert("tags", { name: "Product" });
    const tagCompliance = await ctx.db.insert("tags", { name: "Compliance" });

    // Create courses
    // Course 1: Sales Fundamentals (published)
    const course1 = await ctx.db.insert("courses", {
      title: "Sales Fundamentals",
      description:
        "Learn the essential skills and techniques for successful B2B sales. This comprehensive course covers everything from prospecting to closing deals.",
      creatorId: adminUser,
      status: "published",
      visibility: "all_teams",
      displayOrder: 1,
      viewCount: 156,
      publishedAt: now - 30 * 24 * 60 * 60 * 1000,
    });
    counts.courses++;

    await ctx.db.insert("courseTags", { courseId: course1, tagId: tagSales });
    await ctx.db.insert("courseTags", {
      courseId: course1,
      tagId: tagOnboarding,
    });

    // Course 1 sections and lessons
    const section1_1 = await ctx.db.insert("sections", {
      courseId: course1,
      title: "Introduction to B2B Sales",
      description: "Understanding the B2B sales landscape",
      displayOrder: 1,
    });
    counts.sections++;

    const lesson1_1_1 = await ctx.db.insert("lessons", {
      sectionId: section1_1,
      type: "text",
      title: "What is B2B Sales?",
      description: "An overview of business-to-business sales",
      estimatedDuration: 10,
      content: [
        {
          type: "p",
          children: [
            {
              text: "B2B (Business-to-Business) sales involves selling products or services from one business to another. Unlike B2C sales, B2B transactions typically involve longer sales cycles, multiple decision-makers, and higher transaction values.",
            },
          ],
        },
        {
          type: "h2",
          children: [{ text: "Key Characteristics of B2B Sales" }],
        },
        {
          type: "ul",
          children: [
            {
              type: "li",
              children: [{ text: "Longer decision-making process" }],
            },
            {
              type: "li",
              children: [{ text: "Multiple stakeholders involved" }],
            },
            {
              type: "li",
              children: [{ text: "Focus on ROI and business value" }],
            },
            {
              type: "li",
              children: [{ text: "Relationship-driven approach" }],
            },
          ],
        },
      ],
      displayOrder: 1,
    });
    counts.lessons++;

    const lesson1_1_2 = await ctx.db.insert("lessons", {
      sectionId: section1_1,
      type: "embed",
      title: "The Sales Process Overview",
      description: "Watch this video introduction to the sales process",
      estimatedDuration: 15,
      displayOrder: 2,
    });
    counts.lessons++;

    await ctx.db.insert("embedConfigs", {
      lessonId: lesson1_1_2,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      provider: "youtube",
    });

    const section1_2 = await ctx.db.insert("sections", {
      courseId: course1,
      title: "Prospecting Techniques",
      description: "Finding and qualifying potential customers",
      displayOrder: 2,
    });
    counts.sections++;

    const lesson1_2_1 = await ctx.db.insert("lessons", {
      sectionId: section1_2,
      type: "text",
      title: "Cold Outreach Best Practices",
      description: "Effective strategies for cold calling and emailing",
      estimatedDuration: 20,
      content: [
        {
          type: "p",
          children: [
            {
              text: "Cold outreach remains one of the most effective ways to generate new business opportunities when done correctly.",
            },
          ],
        },
      ],
      displayOrder: 1,
    });
    counts.lessons++;

    const lesson1_2_2 = await ctx.db.insert("lessons", {
      sectionId: section1_2,
      type: "quiz",
      title: "Prospecting Knowledge Check",
      description: "Test your understanding of prospecting techniques",
      estimatedDuration: 10,
      displayOrder: 2,
    });
    counts.lessons++;

    const quizConfig1 = await ctx.db.insert("quizConfigs", {
      lessonId: lesson1_2_2,
      passingScore: 70,
      allowRetry: true,
      maxAttempts: 3,
      showAnswers: true,
    });

    await ctx.db.insert("quizQuestions", {
      quizConfigId: quizConfig1,
      questionText:
        "What is the primary goal of prospecting in B2B sales?",
      options: [
        { text: "To close deals immediately", isCorrect: false },
        {
          text: "To identify and qualify potential customers",
          isCorrect: true,
        },
        { text: "To send as many emails as possible", isCorrect: false },
        { text: "To reduce the sales cycle", isCorrect: false },
      ],
      explanation:
        "Prospecting is about finding and qualifying leads, not immediate closing.",
      points: 10,
      displayOrder: 1,
    });

    await ctx.db.insert("quizQuestions", {
      quizConfigId: quizConfig1,
      questionText: "Which of the following is a best practice for cold emails?",
      options: [
        { text: "Use generic templates for everyone", isCorrect: false },
        { text: "Personalize based on the recipient's business", isCorrect: true },
        { text: "Make the email as long as possible", isCorrect: false },
        { text: "Never follow up", isCorrect: false },
      ],
      explanation:
        "Personalization significantly improves response rates in cold outreach.",
      points: 10,
      displayOrder: 2,
    });

    // Course 2: Product Knowledge (published, specific teams)
    const course2 = await ctx.db.insert("courses", {
      title: "Product Knowledge Deep Dive",
      description:
        "Master our product features, use cases, and competitive advantages.",
      creatorId: adminUser,
      status: "published",
      visibility: "specific_teams",
      displayOrder: 2,
      viewCount: 89,
      publishedAt: now - 14 * 24 * 60 * 60 * 1000,
    });
    counts.courses++;

    await ctx.db.insert("courseTags", { courseId: course2, tagId: tagProduct });
    await ctx.db.insert("courseAssignments", {
      courseId: course2,
      teamId: salesTeam,
      assignedAt: now,
    });
    await ctx.db.insert("courseAssignments", {
      courseId: course2,
      teamId: supportTeam,
      assignedAt: now,
    });

    const section2_1 = await ctx.db.insert("sections", {
      courseId: course2,
      title: "Core Features",
      description: "Understanding our main product capabilities",
      displayOrder: 1,
    });
    counts.sections++;

    await ctx.db.insert("lessons", {
      sectionId: section2_1,
      type: "text",
      title: "Feature Overview",
      description: "A comprehensive look at our product features",
      estimatedDuration: 25,
      content: [
        {
          type: "p",
          children: [
            {
              text: "Our platform offers a comprehensive suite of tools designed to streamline business operations.",
            },
          ],
        },
      ],
      displayOrder: 1,
    });
    counts.lessons++;

    // Course 3: Compliance Training (draft)
    const course3 = await ctx.db.insert("courses", {
      title: "Annual Compliance Training",
      description:
        "Required compliance training covering security, privacy, and company policies.",
      creatorId: adminUser,
      status: "draft",
      visibility: "all_teams",
      displayOrder: 3,
      viewCount: 0,
    });
    counts.courses++;

    await ctx.db.insert("courseTags", {
      courseId: course3,
      tagId: tagCompliance,
    });

    const section3_1 = await ctx.db.insert("sections", {
      courseId: course3,
      title: "Security Fundamentals",
      description: "Basic security practices",
      displayOrder: 1,
    });
    counts.sections++;

    await ctx.db.insert("lessons", {
      sectionId: section3_1,
      type: "text",
      title: "Password Security",
      description: "Best practices for password management",
      estimatedDuration: 10,
      content: [
        {
          type: "p",
          children: [
            { text: "This lesson covers password security best practices." },
          ],
        },
      ],
      displayOrder: 1,
    });
    counts.lessons++;

    // Create some progress records
    await ctx.db.insert("progress", {
      userId: users[0]!,
      lessonId: lesson1_1_1,
      status: "completed",
      completedAt: now - 5 * 24 * 60 * 60 * 1000,
      lastAccessedAt: now - 5 * 24 * 60 * 60 * 1000,
      timeSpent: 600,
    });

    await ctx.db.insert("progress", {
      userId: users[0]!,
      lessonId: lesson1_1_2,
      status: "completed",
      completedAt: now - 4 * 24 * 60 * 60 * 1000,
      lastAccessedAt: now - 4 * 24 * 60 * 60 * 1000,
      timeSpent: 900,
    });

    await ctx.db.insert("progress", {
      userId: users[0]!,
      lessonId: lesson1_2_1,
      status: "in_progress",
      lastAccessedAt: now - 1 * 24 * 60 * 60 * 1000,
      timeSpent: 300,
    });

    await ctx.db.insert("progress", {
      userId: users[1]!,
      lessonId: lesson1_1_1,
      status: "completed",
      completedAt: now - 10 * 24 * 60 * 60 * 1000,
      lastAccessedAt: now - 10 * 24 * 60 * 60 * 1000,
      timeSpent: 450,
    });

    // Create a quiz attempt
    await ctx.db.insert("quizAttempts", {
      userId: users[0]!,
      quizConfigId: quizConfig1,
      answers: { q1: 1, q2: 1 },
      score: 20,
      maxScore: 20,
      passed: true,
      attemptNumber: 1,
      submittedAt: now - 3 * 24 * 60 * 60 * 1000,
    });

    // Create some comments
    await ctx.db.insert("comments", {
      authorId: users[0]!,
      courseId: course1,
      content:
        "Great course! Really helped me understand the basics of B2B sales.",
      isPinned: true,
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
    });

    const comment2 = await ctx.db.insert("comments", {
      authorId: users[1]!,
      lessonId: lesson1_1_1,
      content: "Could you add more examples about the sales process?",
      isPinned: false,
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("comments", {
      authorId: adminUser,
      lessonId: lesson1_1_1,
      parentId: comment2,
      content:
        "Great suggestion! We'll be adding more case studies in the next update.",
      isPinned: false,
      createdAt: now - 1 * 24 * 60 * 60 * 1000,
    });

    // Create a conversation with messages
    const conversation = await ctx.db.insert("conversations", {
      type: "direct",
      updatedAt: now,
    });

    await ctx.db.insert("conversationParticipants", {
      conversationId: conversation,
      userId: users[0]!,
      joinedAt: now - 3 * 24 * 60 * 60 * 1000,
      lastReadAt: now,
    });

    await ctx.db.insert("conversationParticipants", {
      conversationId: conversation,
      userId: users[1]!,
      joinedAt: now - 3 * 24 * 60 * 60 * 1000,
      lastReadAt: now - 1 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("messages", {
      conversationId: conversation,
      senderId: users[0]!,
      content: "Hey Bob, did you finish the Sales Fundamentals course?",
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("messages", {
      conversationId: conversation,
      senderId: users[1]!,
      content: "Almost! Just have the quiz left. How was it?",
      createdAt: now - 1 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000,
    });

    await ctx.db.insert("messages", {
      conversationId: conversation,
      senderId: users[0]!,
      content:
        "Pretty straightforward if you paid attention to the prospecting section!",
      createdAt: now - 1 * 24 * 60 * 60 * 1000,
    });

    // Create some activity logs
    await ctx.db.insert("activityLogs", {
      userId: users[0]!,
      actionType: "login",
      category: "user",
      timestamp: now - 1 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("activityLogs", {
      userId: users[0]!,
      actionType: "lesson_view",
      category: "course",
      entityType: "lesson",
      entityId: lesson1_2_1.toString(),
      timestamp: now - 1 * 24 * 60 * 60 * 1000 + 60 * 1000,
    });

    await ctx.db.insert("activityLogs", {
      userId: users[0]!,
      actionType: "quiz_submit",
      category: "quiz",
      entityType: "quiz",
      entityId: quizConfig1.toString(),
      metadata: { score: 100, passed: true },
      timestamp: now - 3 * 24 * 60 * 60 * 1000,
    });

    // Create sessions
    await ctx.db.insert("sessions", {
      userId: users[0]!,
      startedAt: now - 1 * 24 * 60 * 60 * 1000,
      endedAt: now - 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
      duration: 2 * 60 * 60 * 1000,
    });

    await ctx.db.insert("sessions", {
      userId: users[1]!,
      startedAt: now - 2 * 60 * 60 * 1000,
    });

    return counts;
  },
});

/**
 * Quick seed for testing - creates minimal data
 */
export const quickSeed = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const now = Date.now();

    // Create admin user
    const adminUser = await ctx.db.insert("users", {
      clerkId: "quick_seed_admin",
      email: "quickadmin@example.com",
      name: "Quick Admin",
      role: "admin",
      status: "online",
      lastActiveAt: now,
    });

    // Create regular user
    const regularUser = await ctx.db.insert("users", {
      clerkId: "quick_seed_user",
      email: "quickuser@example.com",
      name: "Quick User",
      role: "user",
      status: "online",
      lastActiveAt: now,
    });

    // Create a simple course
    const course = await ctx.db.insert("courses", {
      title: "Quick Start Course",
      description: "A simple test course",
      creatorId: adminUser,
      status: "published",
      visibility: "all_teams",
      displayOrder: 1,
      viewCount: 0,
      publishedAt: now,
    });

    const section = await ctx.db.insert("sections", {
      courseId: course,
      title: "Getting Started",
      displayOrder: 1,
    });

    await ctx.db.insert("lessons", {
      sectionId: section,
      type: "text",
      title: "Welcome",
      content: [{ type: "p", children: [{ text: "Welcome to the course!" }] }],
      displayOrder: 1,
    });

    return `Created admin (${adminUser}), user (${regularUser}), and course (${course})`;
  },
});
