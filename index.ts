import React from 'react';
import { registerRootComponent } from 'expo';
import { Text, View } from 'react-native';
import App from './App';

type BoundaryState = {
  error: Error | null;
};

class RootErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Nexus Rush runtime error', error);
  }

  render() {
    if (this.state.error) {
      return React.createElement(
        View,
        {
          style: {
            flex: 1,
            backgroundColor: '#080c14',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24
          }
        },
        React.createElement(
          Text,
          {
            style: {
              color: '#ffffff',
              fontSize: 22,
              fontWeight: '700',
              marginBottom: 12,
              textAlign: 'center'
            }
          },
          'Nexus Rush non è riuscito ad avviarsi'
        ),
        React.createElement(
          Text,
          {
            style: {
              color: '#a9bad1',
              fontSize: 14,
              textAlign: 'center',
              maxWidth: 620
            }
          },
          this.state.error.message
        )
      );
    }

    return this.props.children;
  }
}

function Root() {
  return React.createElement(
    RootErrorBoundary,
    null,
    React.createElement(App)
  );
}

registerRootComponent(Root);
