import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  PendingApproval: { email?: string; businessName?: string } | undefined;
  AccountDisabled: { reason?: string } | undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  CatalogueTab: { categoryId?: string; searchQuery?: string } | undefined;
  CartTab: undefined;
  OrdersTab: undefined;
  AccountTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  ProductDetails: { productId: string };
  Checkout: undefined;
  OrderDetails: { orderId: string };
  PendingApproval: { email?: string; businessName?: string } | undefined;
  AccountDisabled: { reason?: string } | undefined;
};
