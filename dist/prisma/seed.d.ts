export declare const seedSuperAdmin: () => Promise<{
    id: string;
    email: string;
    password: string | null;
    googleId: string | null;
    role: import("@prisma/client").$Enums.Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare const seedTesterAdmin: () => Promise<{
    id: string;
    email: string;
    password: string | null;
    googleId: string | null;
    role: import("@prisma/client").$Enums.Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare const seedTesterFaculty: () => Promise<{
    id: string;
    email: string;
    password: string | null;
    googleId: string | null;
    role: import("@prisma/client").$Enums.Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare const seedTesterStudent: () => Promise<{
    id: string;
    email: string;
    password: string | null;
    googleId: string | null;
    role: import("@prisma/client").$Enums.Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare const seedAll: () => Promise<void>;
//# sourceMappingURL=seed.d.ts.map