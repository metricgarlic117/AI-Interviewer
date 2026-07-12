/**
 * White Box Unit Tests: components/Navbar.tsx
 * Tests rendering, visibility logic, active link highlighting, and logout behavior.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Navbar from "../../components/Navbar";

// Mock firebase/auth
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock("firebase/auth", () => ({
  signOut: (...args) => mockSignOut(...args),
  onAuthStateChanged: (...args) => {
    mockOnAuthStateChanged(...args);
    if (typeof args[1] === "function") {
      args[1](null);
    }
    return jest.fn();
  },
}));

// Mock our firebase service
jest.mock("../../services/firebase", () => ({
  auth: { currentUser: null },
}));

const mockUsePathname = jest.fn().mockReturnValue("/dashboard");
const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockUsePathname.mockReturnValue("/dashboard");
});

describe("Navbar visibility", () => {
  it('returns null on the root "/" route', () => {
    mockUsePathname.mockReturnValue("/");
    const { container } = render(<Navbar />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null on the "/login" route', () => {
    mockUsePathname.mockReturnValue("/login");
    const { container } = render(<Navbar />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null on the "/signup" route', () => {
    mockUsePathname.mockReturnValue("/signup");
    const { container } = render(<Navbar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders on a protected route like "/dashboard"', () => {
    mockUsePathname.mockReturnValue("/dashboard");
    render(<Navbar />);
    expect(screen.getByText("AlgoMock")).toBeInTheDocument();
  });

  it('renders on other protected routes like "/profile"', () => {
    mockUsePathname.mockReturnValue("/profile");
    render(<Navbar />);
    expect(screen.getByText("AlgoMock")).toBeInTheDocument();
  });
});

describe("Navbar content", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
  });

  it('renders the brand name "AlgoMock"', () => {
    render(<Navbar />);
    expect(screen.getByText("AlgoMock")).toBeInTheDocument();
  });

  it("renders a Dashboard navigation link", () => {
    render(<Navbar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders a Profile navigation link", () => {
    render(<Navbar />);
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders a Logout button", () => {
    render(<Navbar />);
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });
});

describe("Navbar active link highlighting", () => {
  it("applies active class to Dashboard link when on /dashboard", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    render(<Navbar />);
    const dashboardLink = screen.getByText("Dashboard");
    expect(dashboardLink.className).toContain("bg-blue-100");
    expect(dashboardLink.className).toContain("text-blue-700");
  });

  it("applies active class to Profile link when on /profile", () => {
    mockUsePathname.mockReturnValue("/profile");
    render(<Navbar />);
    const profileLink = screen.getByText("Profile");
    expect(profileLink.className).toContain("bg-blue-100");
    expect(profileLink.className).toContain("text-blue-700");
  });

  it("does NOT apply active class to Dashboard link when on /profile", () => {
    mockUsePathname.mockReturnValue("/profile");
    render(<Navbar />);
    const dashboardLink = screen.getByText("Dashboard");
    expect(dashboardLink.className).not.toContain("bg-blue-100");
  });
});

describe("Navbar logout", () => {
  it("calls signOut when Logout button is clicked", async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(<Navbar />);

    await act(async () => {
      fireEvent.click(screen.getByText("Logout"));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("navigates to /login after successful logout", async () => {
    mockSignOut.mockResolvedValue(undefined);
    render(<Navbar />);

    await act(async () => {
      fireEvent.click(screen.getByText("Logout"));
    });

    expect(mockRouterPush).toHaveBeenCalledWith("/login");
  });

  it("does not crash if signOut throws", async () => {
    mockSignOut.mockRejectedValue(new Error("Sign out failed"));
    render(<Navbar />);

    // Should not throw, error is caught internally
    await act(async () => {
      fireEvent.click(screen.getByText("Logout"));
    });

    expect(mockSignOut).toHaveBeenCalled();
  });
});
