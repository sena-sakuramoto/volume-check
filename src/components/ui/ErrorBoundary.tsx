'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isWebGL = this.state.error?.message?.toLowerCase().includes('webgl')
        || this.state.error?.message?.toLowerCase().includes('context');

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-bold text-destructive">
              {isWebGL ? '3D表示でエラーが発生しました' : 'エラーが発生しました'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isWebGL
                ? 'WebGLの初期化に失敗しました。ブラウザがWebGLに対応しているか確認してください。'
                : 'アプリケーションで予期しないエラーが発生しました。再試行してください。'}
            </p>
            <pre className="text-xs text-muted-foreground bg-card border border-border rounded p-3 overflow-auto max-h-32 text-left">
              {this.state.error?.message}
            </pre>
            <button
              onClick={this.handleRetry}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              再試行
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
