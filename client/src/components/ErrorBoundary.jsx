import React from 'react';
import { TriangleAlert } from 'lucide-react';

/** Catches render errors so the demo never shows a blank screen. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Restock UI error:', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.compact) {
      return (
        <div className="card flex items-center gap-3 text-sm text-ink-2" role="alert">
          <TriangleAlert size={18} className="text-warn" aria-hidden="true" />
          This panel hit an error.
          <button className="btn btn-sm ml-auto" onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return (
      <div className="card mx-auto my-20 max-w-lg text-center" role="alert">
        <TriangleAlert size={28} className="mx-auto text-warn" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold">Something went wrong on this screen</h2>
        <p className="mt-1 text-sm text-ink-2">{String(this.state.error.message || this.state.error)}</p>
        <button className="btn btn-primary mt-5" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
