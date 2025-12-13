"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import confetti from "canvas-confetti";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  XCircle,
  Trophy,
  RefreshCw,
  HelpCircle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// GIF URLs from Giphy - Professional/Educational context
const SUCCESS_GIFS = [
  "https://media3.giphy.com/media/lMBcCPM0VYfhh2zCAy/giphy.gif", // Well Done Win
  "https://media1.giphy.com/media/LlYjGi9rErbLjyaMNr/giphy.gif", // Super Mario Win
  "https://media2.giphy.com/media/26gsobowozGM9umBi/giphy.gif", // Success celebration
];

const FAILURE_GIFS = [
  "https://media.giphy.com/media/iemmYj32EiEeZYvjpq/giphy.gif", // Try Again You Can Do It
  "https://media.giphy.com/media/lOadFSN6uNANXNRZDA/giphy.gif", // Encouragement
  "https://media.giphy.com/media/VL48WGMDjD64umCEkv/giphy.gif", // Try Again
];

// Get random GIF
const getRandomGif = (isCorrect: boolean): string => {
  const gifs = isCorrect ? SUCCESS_GIFS : FAILURE_GIFS;
  return gifs[Math.floor(Math.random() * gifs.length)] as string;
};

// Trigger confetti
const triggerConfetti = () => {
  const end = Date.now() + 2000;
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1", "#22c55e"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
};

interface QuizQuestion {
  _id: Id<"quizQuestions">;
  questionText: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  explanation?: string;
  points: number;
  displayOrder: number;
}

interface QuizConfig {
  passingScore: number;
  allowRetry: boolean;
  maxAttempts?: number;
  showAnswers: boolean;
  questions: QuizQuestion[];
}

interface QuizPlayerProps {
  lessonId: Id<"lessons">;
  quizConfig: QuizConfig;
  lessonTitle: string;
}

interface AnswerResult {
  questionId: Id<"quizQuestions">;
  selectedOptions: number[];
  isCorrect: boolean;
  correctOptions: number[];
  points: number;
}

type QuizState = "loading" | "intro" | "in-progress" | "feedback" | "completed";

export function QuizPlayer({ lessonId, quizConfig }: QuizPlayerProps) {
  const [quizState, setQuizState] = useState<QuizState>("loading");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [answerResults, setAnswerResults] = useState<AnswerResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{
    isCorrect: boolean;
    correctOptions: number[];
    explanation?: string;
    gifUrl: string;
  } | null>(null);

  // Queries and mutations
  const quizStatus = useQuery(api.quizzes.getQuizStatus, { lessonId });
  const checkAnswerMutation = useMutation(api.quizzes.checkAnswer);
  const submitQuiz = useMutation(api.quizzes.submit);

  // Sort questions by display order
  const sortedQuestions = [...quizConfig.questions].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const currentQuestion = sortedQuestions[currentQuestionIndex];
  const totalQuestions = sortedQuestions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  // Initialize state when quiz status loads
  useEffect(() => {
    if (quizStatus !== undefined && quizState === "loading") {
      setQuizState("intro");
    }
  }, [quizStatus, quizState]);

  // Handle option toggle
  const handleOptionToggle = (optionIndex: number) => {
    setSelectedOptions((prev) => {
      if (prev.includes(optionIndex)) {
        return prev.filter((idx) => idx !== optionIndex);
      }
      return [...prev, optionIndex];
    });
  };

  // Handle submit answer
  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return;

    setIsChecking(true);
    try {
      const result = await checkAnswerMutation({
        questionId: currentQuestion._id,
        selectedOptions,
      });

      // Store result
      const answerResult: AnswerResult = {
        questionId: currentQuestion._id,
        selectedOptions: [...selectedOptions],
        isCorrect: result.isCorrect,
        correctOptions: result.correctOptions,
        points: result.points,
      };
      setAnswerResults((prev) => [...prev, answerResult]);

      // Show feedback dialog
      setFeedbackData({
        isCorrect: result.isCorrect,
        correctOptions: result.correctOptions,
        explanation: result.explanation,
        gifUrl: getRandomGif(result.isCorrect),
      });
      setQuizState("feedback");

      // Trigger confetti on correct answer
      if (result.isCorrect) {
        triggerConfetti();
      }
    } catch (error) {
      console.error("Failed to check answer:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // Handle next question
  const handleNextQuestion = () => {
    setFeedbackData(null);
    setSelectedOptions([]);

    if (isLastQuestion) {
      // Submit full quiz and show completion
      handleCompleteQuiz();
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      setQuizState("in-progress");
    }
  };

  // Handle complete quiz
  const handleCompleteQuiz = async () => {
    setIsSubmitting(true);
    try {
      await submitQuiz({
        lessonId,
        answers: answerResults.map((r) => ({
          questionId: r.questionId,
          selectedOptions: r.selectedOptions,
        })),
      });
      setQuizState("completed");
    } catch (error) {
      console.error("Failed to submit quiz:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle start quiz
  const handleStart = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setAnswerResults([]);
    setFeedbackData(null);
    setQuizState("in-progress");
  };

  // Handle retry
  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setAnswerResults([]);
    setFeedbackData(null);
    setQuizState("in-progress");
  };

  // Calculate score
  const totalPoints = sortedQuestions.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = answerResults.reduce((sum, r) => sum + r.points, 0);
  const correctCount = answerResults.filter((r) => r.isCorrect).length;
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = percentage >= quizConfig.passingScore;

  // Loading state
  if (quizState === "loading" || quizStatus === undefined) {
    return <QuizSkeleton />;
  }

  // Intro state
  if (quizState === "intro") {
    return (
      <QuizIntro
        quizConfig={quizConfig}
        quizStatus={quizStatus}
        onStart={handleStart}
      />
    );
  }

  // Completed state
  if (quizState === "completed") {
    return (
      <QuizCompleted
        correctCount={correctCount}
        totalQuestions={totalQuestions}
        earnedPoints={earnedPoints}
        totalPoints={totalPoints}
        percentage={percentage}
        passed={passed}
        passingScore={quizConfig.passingScore}
        canRetry={quizStatus.canAttempt && (quizConfig.allowRetry || !passed)}
        onRetry={handleRetry}
      />
    );
  }

  // In-progress state (question display)
  return (
    <>
      <div className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <span>{correctCount} correct so far</span>
          </div>
          <Progress
            value={((currentQuestionIndex) / totalQuestions) * 100}
            className="h-2"
          />
        </div>

        {/* Question Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="text-muted-foreground mr-2">
                Q{currentQuestionIndex + 1}.
              </span>
              {currentQuestion?.questionText}
            </CardTitle>
            <CardDescription>
              {currentQuestion?.points} point{currentQuestion && currentQuestion.points > 1 ? "s" : ""} •
              Select all that apply
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQuestion?.options.map((option, optIndex) => {
              const isSelected = selectedOptions.includes(optIndex);

              return (
                <label
                  key={optIndex}
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleOptionToggle(optIndex)}
                    className="mt-0.5"
                  />
                  <span>{option.text}</span>
                </label>
              );
            })}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmitAnswer}
              disabled={selectedOptions.length === 0 || isChecking}
              className="w-full"
              size="lg"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                "Submit Answer"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={quizState === "feedback"} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4">
              {feedbackData && (
                <Image
                  src={feedbackData.gifUrl}
                  alt={feedbackData.isCorrect ? "Correct!" : "Incorrect"}
                  width={200}
                  height={150}
                  className="rounded-lg mx-auto"
                  unoptimized
                />
              )}
            </div>
            <DialogTitle className={cn(
              "text-2xl",
              feedbackData?.isCorrect ? "text-green-600" : "text-red-600"
            )}>
              {feedbackData?.isCorrect ? "Correct!" : "Not Quite"}
            </DialogTitle>
            <DialogDescription>
              {feedbackData?.isCorrect
                ? `Great job! +${currentQuestion?.points} point${currentQuestion && currentQuestion.points > 1 ? "s" : ""}`
                : "Don't worry, keep learning!"}
            </DialogDescription>
          </DialogHeader>

          {/* Show correct answer if incorrect */}
          {feedbackData && !feedbackData.isCorrect && currentQuestion && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Correct answer(s):</p>
              {feedbackData.correctOptions.map((optIndex) => (
                <div
                  key={optIndex}
                  className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm">{currentQuestion.options[optIndex]?.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Explanation */}
          {feedbackData?.explanation && (
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Explanation</AlertTitle>
              <AlertDescription>{feedbackData.explanation}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button onClick={handleNextQuestion} className="w-full" size="lg">
              {isLastQuestion ? (
                isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Finishing...
                  </>
                ) : (
                  <>
                    See Results
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )
              ) : (
                <>
                  Next Question
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// Sub-components
// ============================================

interface QuizIntroProps {
  quizConfig: QuizConfig;
  quizStatus: {
    attemptCount: number;
    maxAttempts?: number;
    bestScore?: number;
    passed: boolean;
    canAttempt: boolean;
    passingScore: number;
  };
  onStart: () => void;
}

function QuizIntro({ quizConfig, quizStatus, onStart }: QuizIntroProps) {
  const totalPoints = quizConfig.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Quiz Time!
        </CardTitle>
        <CardDescription>
          Answer one question at a time and get instant feedback
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quiz stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Questions</p>
            <p className="font-medium">{quizConfig.questions.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Total Points</p>
            <p className="font-medium">{totalPoints}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Passing Score</p>
            <p className="font-medium">{quizConfig.passingScore}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Attempts</p>
            <p className="font-medium">
              {quizStatus.attemptCount}
              {quizStatus.maxAttempts ? ` / ${quizStatus.maxAttempts}` : " (unlimited)"}
            </p>
          </div>
        </div>

        {/* Previous attempts info */}
        {quizStatus.attemptCount > 0 && (
          <Alert variant={quizStatus.passed ? "default" : "destructive"}>
            {quizStatus.passed ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {quizStatus.passed ? "Quiz Passed!" : "Not Yet Passed"}
            </AlertTitle>
            <AlertDescription>
              Best score: {quizStatus.bestScore}% •
              {quizStatus.passed
                ? " You've already completed this quiz successfully."
                : ` You need ${quizStatus.passingScore}% to pass.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Cannot attempt warning */}
        {!quizStatus.canAttempt && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>No Attempts Remaining</AlertTitle>
            <AlertDescription>
              You&apos;ve used all {quizStatus.maxAttempts} attempts for this quiz.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={onStart}
          disabled={!quizStatus.canAttempt}
          className="w-full"
          size="lg"
        >
          {quizStatus.attemptCount === 0
            ? "Start Quiz"
            : quizStatus.passed
              ? "Retake Quiz"
              : "Try Again"}
        </Button>
      </CardFooter>
    </Card>
  );
}

interface QuizCompletedProps {
  correctCount: number;
  totalQuestions: number;
  earnedPoints: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  passingScore: number;
  canRetry: boolean;
  onRetry: () => void;
}

function QuizCompleted({
  correctCount,
  totalQuestions,
  earnedPoints,
  totalPoints,
  percentage,
  passed,
  passingScore,
  canRetry,
  onRetry,
}: QuizCompletedProps) {
  // Trigger confetti if passed
  useEffect(() => {
    if (passed) {
      triggerConfetti();
    }
  }, [passed]);

  return (
    <Card className={cn(
      "border-2",
      passed ? "border-green-500" : "border-red-500"
    )}>
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          {passed ? (
            <Trophy className="h-20 w-20 text-yellow-500 mx-auto" />
          ) : (
            <XCircle className="h-20 w-20 text-red-500 mx-auto" />
          )}

          <div>
            <h2 className="text-3xl font-bold">
              {passed ? "Congratulations!" : "Keep Practicing!"}
            </h2>
            <p className="text-muted-foreground mt-1">
              {passed
                ? "You passed the quiz!"
                : `You need ${passingScore}% to pass.`}
            </p>
          </div>

          <div className="text-5xl font-bold">
            {percentage}%
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm max-w-xs mx-auto">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Correct</p>
              <p className="text-xl font-semibold">{correctCount}/{totalQuestions}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-muted-foreground">Points</p>
              <p className="text-xl font-semibold">{earnedPoints}/{totalPoints}</p>
            </div>
          </div>
        </div>
      </CardContent>
      {canRetry && (
        <CardFooter>
          <Button onClick={onRetry} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function QuizSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
