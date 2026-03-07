export interface SharedPasswordVerifier {
  verify: (password: string) => Promise<boolean>;
}
