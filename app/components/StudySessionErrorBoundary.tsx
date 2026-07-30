"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

type StudySessionErrorBoundaryProps = {
  children: ReactNode;
  onReturnToDashboard: () => void;
};

type StudySessionErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class StudySessionErrorBoundary extends Component<
  StudySessionErrorBoundaryProps,
  StudySessionErrorBoundaryState
> {
  state: StudySessionErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): StudySessionErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "An unexpected study session error occurred.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Study session render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="space-y-4 text-center">
          <h2 className="text-xl font-semibold text-text-primary">
            Study session interrupted
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            Something went wrong while loading this card. Your progress should
            still be saved. Return to the dashboard and choose Resume Studying.
          </p>
          <p className="text-xs text-text-muted">{this.state.message}</p>
          <Button fullWidth onClick={this.props.onReturnToDashboard}>
            Return to Dashboard
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}
