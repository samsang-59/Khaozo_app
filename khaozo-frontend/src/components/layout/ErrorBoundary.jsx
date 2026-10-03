import { Component } from 'react';
import { ErrorState } from '@/components/shared/States.jsx';

// Render crash in a page → friendly error instead of a white screen
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] crashed', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-5 pt-12">
          <ErrorState
            title="This page tripped over"
            message="Something broke while showing this page. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
            retryLabel="Reload"
          />
        </div>
      );
    }
    return this.props.children;
  }
}
