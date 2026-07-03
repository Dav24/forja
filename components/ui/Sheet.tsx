import { forwardRef, useCallback } from 'react';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

interface SheetProps {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
}

export const Sheet = forwardRef<BottomSheet, SheetProps>(function Sheet(
  { children, snapPoints, ...props },
  ref,
) {
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
      <BottomSheetView>
        <View className="px-5 pb-8">{children}</View>
      </BottomSheetView>
    </BottomSheet>
  );
});
