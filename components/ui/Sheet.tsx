import { forwardRef, useCallback } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/lib/theme';
import BottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

interface SheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  scrollable?: boolean;
}

export const Sheet = forwardRef<BottomSheet, SheetProps>(function Sheet(
  { children, snapPoints, scrollable, ...props },
  ref,
) {
  const { colors } = useTheme();
  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
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
      backgroundStyle={{ backgroundColor: colors.surfaceElevated }}
      handleIndicatorStyle={{ backgroundColor: colors.accent }}
      {...props}
    >
      {scrollable ? (
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView>
          <View className="px-5 pb-8">{children}</View>
        </BottomSheetView>
      )}
    </BottomSheet>
  );
});
