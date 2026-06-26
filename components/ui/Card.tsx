import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ elevated = false, className = '', children, ...props }: CardProps) {
  return (
    <View
      className={`${elevated ? 'bg-surface-elevated' : 'bg-surface'} border border-border rounded-2xl p-4 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
