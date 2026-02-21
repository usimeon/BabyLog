import { StyleSheet } from 'react-native';
import { AppTheme } from '../theme/designSystem';

export const createNavigationStyles = (theme: AppTheme) =>
  StyleSheet.create({
    loaderContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    header: {
      elevation: 0,
    },
    headerTitle: {
      ...theme.typography.h6,
      fontWeight: '700',
    },
    headerLeftContainer: {
      paddingLeft: theme.spacing[4],
    },
    headerRightContainer: {
      paddingRight: theme.spacing[4],
    },
    tabBar: {
      height: 72,
      paddingTop: theme.spacing[1],
      paddingBottom: theme.spacing[2],
      borderTopWidth: 1,
      overflow: 'visible',
    },
    tabBarLabel: {
      ...theme.typography.caption,
      marginBottom: 3,
    },
    avatarStackTrigger: {
      width: 62,
      height: 40,
      justifyContent: 'center',
    },
    inactiveAvatar: {
      position: 'absolute',
      left: 18,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#CBD5E1',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inactiveAvatarText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    activeAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FFE194',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    activeAvatarText: {
      ...theme.typography.bodySm,
      color: '#7A5A00',
      fontWeight: '800',
    },
    activeAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
    },
    headerRightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileButtonText: {
      ...theme.typography.bodySm,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    quickAddButton: {
      position: 'absolute',
      left: '50%',
      transform: [{ translateX: -32 }],
      top: -22,
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickAddText: {
      color: '#FFFFFF',
      fontSize: 34,
      lineHeight: 34,
      fontWeight: '500',
    },
    switcherOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[5],
    },
    switcherSheet: {
      width: '100%',
      maxWidth: 360,
      borderRadius: theme.radius.lg,
      padding: theme.spacing[4],
      borderWidth: 1,
      gap: theme.spacing[2],
    },
    switcherTitle: {
      ...theme.typography.h4,
      fontWeight: '800',
    },
    switcherSubtitle: {
      ...theme.typography.bodySm,
      marginBottom: theme.spacing[1],
    },
    switcherHint: {
      ...theme.typography.caption,
      marginBottom: theme.spacing[1],
    },
    switcherRow: {
      minHeight: 48,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      paddingHorizontal: theme.spacing[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    switcherRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      flex: 1,
    },
    switcherRowAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    switcherRowAvatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 15,
    },
    switcherRowAvatarText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    switcherRowText: {
      ...theme.typography.bodySm,
      fontWeight: '700',
    },
    cancelButton: {
      minHeight: 48,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing[1],
    },
    cancelButtonText: {
      ...theme.typography.buttonSm,
      fontWeight: '700',
    },
  });
