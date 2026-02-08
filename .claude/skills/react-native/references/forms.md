# Forms Reference

## Contents
- Form Handling Approach
- TextInput Patterns
- Validation with Zod
- Login Form Example
- Post Composer Example
- Missing Professional Solution
- Anti-Patterns

## Form Handling Approach

This project has no form library installed for mobile. Use controlled `TextInput` components with `useState` for simple forms. For complex forms, consider adding `react-hook-form`.

## TextInput Patterns

### Basic Controlled Input

```tsx
import { useState } from "react";
import { View, TextInput, Text } from "react-native";

export function SearchBar({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <View className="flex-row items-center rounded-lg bg-gray-100 px-4">
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => onSearch(query)}
        placeholder="Search posts..."
        className="flex-1 py-3 text-base"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}
```

### Password Input with Visibility Toggle

```tsx
import { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";

export function PasswordInput({
  value,
  onChangeText,
  placeholder = "Password",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View className="flex-row items-center rounded-lg border border-gray-300 px-4">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!isVisible}
        placeholder={placeholder}
        className="flex-1 py-3 text-base"
        autoCapitalize="none"
        autoComplete="password"
      />
      <Pressable onPress={() => setIsVisible((v) => !v)}>
        <Text className="text-sm text-primary">{isVisible ? "Hide" : "Show"}</Text>
      </Pressable>
    </View>
  );
}
```

## Validation with Zod

Shared schemas live in `@socialhub/shared`. See the **zod** skill for schema patterns.

```tsx
import { useState } from "react";
import { loginSchema } from "@socialhub/shared";
import type { z } from "zod";

type LoginForm = z.infer<typeof loginSchema>;

function validateLogin(form: LoginForm) {
  const result = loginSchema.safeParse(form);
  if (!result.success) {
    // Extract first error per field
    const errors: Partial<Record<keyof LoginForm, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof LoginForm;
      if (!errors[field]) errors[field] = issue.message;
    }
    return { isValid: false as const, errors };
  }
  return { isValid: true as const, data: result.data };
}
```

## Login Form Example

```tsx
// apps/mobile/src/app/(auth)/login.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth.store";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const login = trpc.user.login.useMutation({
    onSuccess: async (data) => {
      await setAuthToken(data.token);
      useAuthStore.getState().setAuth(data.userId);
    },
    onError: (err) => Alert.alert("Login Failed", err.message),
  });

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    login.mutate({ email: email.trim(), password });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 justify-center bg-white p-6"
    >
      <Text className="mb-8 text-center text-3xl font-bold">SocialHub</Text>

      <View className="mb-4">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
        {errors.email && <Text className="mt-1 text-sm text-red-500">{errors.email}</Text>}
      </View>

      <View className="mb-6">
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoComplete="password"
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
        {errors.password && <Text className="mt-1 text-sm text-red-500">{errors.password}</Text>}
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={login.isPending}
        className={`rounded-lg py-4 ${login.isPending ? "bg-gray-400" : "bg-primary active:bg-primary-hover"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {login.isPending ? "Signing in..." : "Sign In"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
```

## Post Composer Example

```tsx
import { useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { trpc } from "@/lib/trpc";
import { useFeedStore } from "@/stores/feed.store";

export function PostComposer() {
  const [content, setContent] = useState("");
  const selectedPlatform = useFeedStore((s) => s.selectedPlatform);
  const utils = trpc.useUtils();

  const publish = trpc.post.create.useMutation({
    onSuccess: () => {
      setContent("");
      utils.post.getFeed.invalidate();
    },
  });

  const isValid = content.trim().length > 0 && content.length <= 280;

  return (
    <View className="border-b border-gray-200 p-4">
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="What's happening?"
        multiline
        maxLength={280}
        className="min-h-[80] text-base"
      />
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-xs text-gray-400">{content.length}/280</Text>
        <Pressable
          onPress={() => publish.mutate({ content, platform: selectedPlatform })}
          disabled={!isValid || publish.isPending}
          className={`rounded-full px-6 py-2 ${isValid ? "bg-primary" : "bg-gray-300"}`}
        >
          <Text className="text-sm font-semibold text-white">Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

## WARNING: Missing Professional Form Library

**Detected:** No `react-hook-form` in mobile dependencies.
**Impact:** Complex forms (multi-step, dynamic fields) will require manual state management, validation wiring, and error handling.

### Recommended Solution

```bash
pnpm --filter @socialhub/mobile add react-hook-form @hookform/resolvers
```

### Quick Start with Zod Integration

```tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@socialhub/shared";

const { control, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(loginSchema),
  defaultValues: { email: "", password: "" },
});
```

## Anti-Patterns

### WARNING: Missing KeyboardAvoidingView

```tsx
// BAD — keyboard covers input fields on iOS
<View className="flex-1 justify-center p-6">
  <TextInput placeholder="Email" />
</View>

// GOOD — keyboard pushes content up
<KeyboardAvoidingView
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  className="flex-1 justify-center p-6"
>
  <TextInput placeholder="Email" />
</KeyboardAvoidingView>
```

### WARNING: Uncontrolled Inputs

```tsx
// BAD — no way to validate or submit programmatically
<TextInput placeholder="Email" />

// GOOD — controlled with state
const [email, setEmail] = useState("");
<TextInput value={email} onChangeText={setEmail} placeholder="Email" />
```
