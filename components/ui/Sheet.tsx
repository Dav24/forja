import { forwardRef, useCallback } from 'react';
import { View } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BottomSheetModule = require('react-native-bottom-sheet');
const BottomSheet = BottomSheetModule.default;
const { BottomSheetBackdrop, BottomSheetView } = BottomSheetModule;

interface SheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  [key: string]: React.ReactNode | (string | number)[] | undefined;
}

export const Sheet = forwardRef<unknown, SheetProps>(function Sheet(
  { children, snapPoints, ...props },
  ref,
) {
  const renderBackdrop = useCallback(
    (backdropProps: Record<string, unknown>) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints ?? ['50%']}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#1E1E2E' }}
      handleIndicatorStyle={{ backgroundColor: '#64748B' }}
      {...props}
    >
      <BottomSheetView>
        <View className="px-5 pb-8">{children}</View>
      </BottomSheetView>
    </BottomSheet>
  );
});
