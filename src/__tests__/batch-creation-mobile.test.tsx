// SPDX-License-Identifier: MIT

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the wallet hook
vi.mock("@/hooks/useMultiWallet", () => ({
  useWallet: () => ({
    wallet: {
      connected: true,
      publicKey: "GBD4R7KL1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZABCD",
      balance: "1000.00",
      activeWalletId: "freighter",
    },
  }),
}));

// Mock the stellar lib
vi.mock("@/lib/stellar", () => ({
  isValidStellarAddress: (addr: string) => /^G[A-Z0-9]{55}$/.test(addr),
  buildBatchPaymentTx: vi.fn(),
  submitSignedTx: vi.fn(),
  getStellarExplorerUrl: (hash: string) => `https://testnet.stellarchain.io/tx/${hash}`,
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

// Mock the wallet connector
vi.mock("@/lib/wallets", () => ({
  getWalletConnector: () => ({
    signTransaction: vi.fn(),
  }),
}));

// Mock the utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | false | undefined | null)[]) => args.filter(Boolean).join(" "),
  formatAmount: (amount: number, code: string) => `${amount.toFixed(2)} ${code}`,
  shortenAddress: (addr: string, chars: number) => `${addr.slice(0, chars + 1)}...${addr.slice(-chars)}`,
}));

// Mock the fee estimator
vi.mock("@/lib/fee-estimator", () => ({
  estimateBatchFee: (count: number) => String(count * 100),
}));

// Mock the CSV import
vi.mock("@/lib/csv-import", () => ({
  parseRecipientsCsv: vi.fn(),
  parseRecipientsCsvToRows: vi.fn().mockResolvedValue({ rows: [], fileErrors: [] }),
  validateRecipientFields: vi.fn().mockReturnValue({}),
  applyDuplicateErrors: vi.fn(),
  downloadCsvTemplate: vi.fn(),
  MAX_BATCH_RECIPIENTS: 100,
}));

// Mock the BatchConfirmDialog
vi.mock("@/components/BatchConfirmDialog", () => ({
  BatchConfirmDialog: ({ open, onCancel }: { open: boolean; onCancel: () => void }) =>
    open ? (
      <div data-testid="batch-confirm-dialog">
        <div>Confirm Batch Payment</div>
        <button onClick={onCancel}>Cancel</button>
        <button data-testid="batch-confirm-send">Confirm & Sign</button>
      </div>
    ) : null,
}));

// Mock the CopyButton
vi.mock("@/components/ui/CopyButton", () => ({
  CopyButton: () => <button>Copy</button>,
}));

// Mock next/link
vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ children, href, ...props }: Record<string, any>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock the AddressBookMultiSelect
vi.mock("@/components/batches/AddressBookMultiSelect", () => ({
  AddressBookMultiSelect: () => <div data-testid="address-book-select" />,
}));

// Mock the address-book lib
vi.mock("@/lib/address-book", () => ({
  mergeAddressBookSelections: (rows: unknown[], _selections: unknown[]) => rows,
}));

import React from "react";
import NewBatchPage from "@/app/batches/new/page";

describe("NewBatchPage - Mobile Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders recipient row inputs in manual mode", () => {
    render(<NewBatchPage />);
    expect(screen.getByPlaceholderText("G... destination address")).toBeDefined();
    expect(screen.getByPlaceholderText("0.00")).toBeDefined();
    expect(screen.getByPlaceholderText("Memo (optional)")).toBeDefined();
  });

  it("renders Add Recipient button", () => {
    render(<NewBatchPage />);
    const addRecipientBtn = screen.getByText("Add Recipient");
    expect(addRecipientBtn).toBeDefined();
    expect(addRecipientBtn.tagName).toBe("BUTTON");
  });

  it("renders Send Batch Payment button with proper touch target", () => {
    render(<NewBatchPage />);
    const sendBtn = screen.getByText("Send Batch Payment");
    expect(sendBtn).toBeDefined();
    // Check for touch-target height (py-3 provides adequate tap area)
    expect(sendBtn.className).toContain("py-3");
  });

  it("renders recipient mode toggle (Manual / Upload CSV)", () => {
    render(<NewBatchPage />);
    expect(screen.getByText("Manual entry")).toBeDefined();
    expect(screen.getByText("Upload CSV")).toBeDefined();
  });

  it("switches to CSV mode and renders the CSV dropzone", async () => {
    const user = userEvent.setup();
    render(<NewBatchPage />);
    await user.click(screen.getByText("Upload CSV"));
    expect(screen.getByTestId("csv-dropzone")).toBeDefined();
  });

  it("has responsive container classes", () => {
    render(<NewBatchPage />);
    const heading = screen.getByText("New Batch Payment");
    const breadcrumbDiv = heading.closest("div");
    const container = breadcrumbDiv?.parentElement;
    expect(container?.className).toContain("px-1");
  });
});
