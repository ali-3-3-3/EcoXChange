import { useState, useCallback } from 'react';
import { useWeb3 } from '../providers/Web3Provider';
import { contractService } from '../services/contractService';
import { apiService } from '../services/apiService';

interface TransactionState {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
}

export const useContract = () => {
  const { account, isConnected, refreshBalances } = useWeb3();
  const [transactionState, setTransactionState] = useState<TransactionState>({
    isLoading: false,
    error: null,
    txHash: null
  });

  const resetTransactionState = useCallback(() => {
    setTransactionState({
      isLoading: false,
      error: null,
      txHash: null
    });
  }, []);

  const executeTransaction = useCallback(async (
    contractMethod: () => Promise<any>,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    if (!isConnected || !account) {
      const error = 'Wallet not connected';
      setTransactionState({ isLoading: false, error, txHash: null });
      onError?.(error);
      return;
    }

    setTransactionState({ isLoading: true, error: null, txHash: null });

    try {
      const result = await contractMethod();
      
      if (result.success) {
        setTransactionState({ 
          isLoading: false, 
          error: null, 
          txHash: result.txHash || null 
        });
        
        // Refresh balances after successful transaction
        await refreshBalances();
        
        onSuccess?.(result);
      } else {
        const error = result.error || 'Transaction failed';
        setTransactionState({ isLoading: false, error, txHash: null });
        onError?.(error);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Transaction failed';
      setTransactionState({ isLoading: false, error: errorMessage, txHash: null });
      onError?.(errorMessage);
    }
  }, [isConnected, account, refreshBalances]);

  // Token operations
  const mintTokens = useCallback(async (
    recipient: string, 
    amount: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    await executeTransaction(
      () => contractService.mintTokens(recipient, amount),
      onSuccess,
      onError
    );
  }, [executeTransaction]);

  const getTokenBalance = useCallback(async (address: string): Promise<string> => {
    try {
      return await contractService.getTokenBalance(address);
    } catch (error: any) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }, []);

  // Company operations
  const registerCompany = useCallback(async (
    name: string,
    walletAddress: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    await executeTransaction(
      () => contractService.registerCompany(name, walletAddress),
      onSuccess,
      onError
    );
  }, [executeTransaction]);

  const addProject = useCallback(async (
    title: string,
    description: string,
    daysTillCompletion: number,
    carbonDioxideSaved: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    await executeTransaction(
      () => contractService.addProject(title, description, daysTillCompletion, carbonDioxideSaved),
      onSuccess,
      onError
    );
  }, [executeTransaction]);

  const getProject = useCallback(async (projectId: number) => {
    try {
      return await contractService.getProject(projectId);
    } catch (error: any) {
      console.error('Error getting project:', error);
      throw error;
    }
  }, []);

  // Trading operations
  const buyCredits = useCallback(async (
    amount: string,
    companyAddress: string,
    projectId: number,
    ethAmount: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    await executeTransaction(
      () => contractService.buyCredits(amount, companyAddress, projectId, ethAmount),
      async (result) => {
        // Also create transaction record in backend
        try {
          await apiService.buyCredits({
            projectId: projectId.toString(),
            amount: parseFloat(amount),
            maxPricePerCredit: parseFloat(ethAmount) / parseFloat(amount),
            companyAddress
          });
        } catch (error) {
          console.warn('Failed to record transaction in backend:', error);
        }
        onSuccess?.(result);
      },
      onError
    );
  }, [executeTransaction]);

  const sellCredits = useCallback(async (
    amount: string,
    projectId: number,
    stakeAmount: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    await executeTransaction(
      () => contractService.sellCredits(amount, projectId, stakeAmount),
      async (result) => {
        // Also create transaction record in backend
        try {
          await apiService.sellCredits({
            projectId: projectId.toString(),
            amount: parseFloat(amount),
            pricePerCredit: parseFloat(stakeAmount) / parseFloat(amount)
          });
        } catch (error) {
          console.warn('Failed to record transaction in backend:', error);
        }
        onSuccess?.(result);
      },
      onError
    );
  }, [executeTransaction]);

  // Pricing operations
  const getCurrentPrice = useCallback(async (projectId: number): Promise<string> => {
    try {
      return await contractService.getCurrentPrice(projectId);
    } catch (error: any) {
      console.error('Error getting current price:', error);
      return '0';
    }
  }, []);

  const getMarketConditions = useCallback(async () => {
    try {
      return await contractService.getMarketConditions();
    } catch (error: any) {
      console.error('Error getting market conditions:', error);
      return null;
    }
  }, []);

  // Validator operations
  const isValidator = useCallback(async (address: string): Promise<boolean> => {
    try {
      return await contractService.isValidator(address);
    } catch (error: any) {
      console.error('Error checking validator status:', error);
      return false;
    }
  }, []);

  const validateProject = useCallback(async (
    companyAddress: string,
    projectId: number,
    isValid: boolean,
    actualEXC: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    await executeTransaction(
      () => contractService.validateProject(companyAddress, projectId, isValid, actualEXC),
      async (result) => {
        // Also record validation in backend
        try {
          await apiService.validateProject({
            companyAddress,
            projectId,
            isValid,
            actualEXC: parseFloat(actualEXC)
          });
        } catch (error) {
          console.warn('Failed to record validation in backend:', error);
        }
        onSuccess?.(result);
      },
      onError
    );
  }, [executeTransaction]);

  // Utility functions
  const toWei = useCallback((amount: string): string => {
    return contractService.toWei(amount);
  }, []);

  const fromWei = useCallback((amount: string): string => {
    return contractService.fromWei(amount);
  }, []);

  const isValidAddress = useCallback((address: string): boolean => {
    return contractService.isValidAddress(address);
  }, []);

  return {
    // State
    transactionState,
    resetTransactionState,
    
    // Token operations
    mintTokens,
    getTokenBalance,
    
    // Company operations
    registerCompany,
    addProject,
    getProject,
    
    // Trading operations
    buyCredits,
    sellCredits,
    
    // Pricing operations
    getCurrentPrice,
    getMarketConditions,
    
    // Validator operations
    isValidator,
    validateProject,
    
    // Utilities
    toWei,
    fromWei,
    isValidAddress,
    
    // Contract service instance
    contractService
  };
};
