import { useCallback } from 'react';
import { Session } from '@wharfkit/session';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { useToast } from '@/hooks/use-toast';

interface TransactionOptions {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

interface TransactionResult {
  success: boolean;
  txId: string | null;
  error?: Error;
}

export function useWaxTransaction(session: Session | null) {
  const { toast } = useToast();

  const executeTransaction = useCallback(async (
    actions: any[],
    options: TransactionOptions = {}
  ): Promise<TransactionResult> => {
    const {
      successTitle = 'Transaction Successful',
      successDescription,
      errorTitle = 'Transaction Failed',
      showSuccessToast = true,
      showErrorToast = true,
    } = options;

    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return { success: false, txId: null };
    }

    try {
      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      if (showSuccessToast) {
        toast({ title: successTitle, description: successDescription });
      }

      return { success: true, txId };
    } catch (error) {
      console.error('Transaction failed:', error);
      closeWharfkitModals();
      
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      const isExpired = errorMessage.toLowerCase().includes('expired');
      const isCancelled = errorMessage.toLowerCase().includes('cancel') || 
                          errorMessage.toLowerCase().includes('rejected');

      if (showErrorToast) {
        toast({
          title: isExpired ? 'Request Expired' : (isCancelled ? 'Transaction Cancelled' : errorTitle),
          description: isExpired ? 'The signing request timed out. Please try again.' : errorMessage,
          variant: 'destructive',
        });
      }

      return { success: false, txId: null, error: error instanceof Error ? error : new Error(errorMessage) };
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
      setTimeout(() => closeWharfkitModals(), 500);
    }
  }, [session, toast]);

  return { executeTransaction };
}
