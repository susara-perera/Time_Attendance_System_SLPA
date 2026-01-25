# 🎯 Quick Reference - Modern Alerts System

## Import & Usage

```javascript
import { showModernAlert, showConfirmDialog } from '../common/ModernAlert';
```

## Alert Types

### ✅ Success Alert
```javascript
showModernAlert({
  type: 'success',
  title: 'Success!',
  message: 'Operation completed successfully',
  duration: 3000,
  showConfetti: true  // Optional 🎉
});
```

### ❌ Error Alert
```javascript
showModernAlert({
  type: 'error',
  title: 'Error',
  message: 'Something went wrong',
  duration: 4000
});
```

### ⚠️ Warning Alert
```javascript
showModernAlert({
  type: 'warning',
  title: 'Warning',
  message: 'Please check your input',
  duration: 3000
});
```

### ℹ️ Info Alert
```javascript
showModernAlert({
  type: 'info',
  title: 'Info',
  message: 'Here is some information',
  duration: 3000
});
```

## Confirmation Dialog

```javascript
const confirmed = await showConfirmDialog({
  title: 'Delete Item',
  message: 'Are you sure? This cannot be undone.',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  type: 'danger'  // 'warning', 'danger', or 'info'
});

if (confirmed) {
  // User clicked confirm
} else {
  // User clicked cancel or closed dialog
}
```

## Complete Examples

### User Creation
```javascript
try {
  await createUser(userData);
  showModernAlert({
    type: 'success',
    title: 'Created!',
    message: 'User created successfully',
    duration: 3000,
    showConfetti: true
  });
} catch (error) {
  showModernAlert({
    type: 'error',
    title: 'Creation Failed',
    message: error.message,
    duration: 4000
  });
}
```

### User Deletion with Confirmation
```javascript
const handleDelete = async (userId) => {
  const confirmed = await showConfirmDialog({
    title: 'Delete User',
    message: 'This action cannot be undone. Are you sure?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    type: 'danger'
  });

  if (confirmed) {
    try {
      await deleteUser(userId);
      showModernAlert({
        type: 'success',
        title: 'Deleted!',
        message: 'User deleted successfully',
        duration: 3000
      });
    } catch (error) {
      showModernAlert({
        type: 'error',
        title: 'Delete Failed',
        message: error.message,
        duration: 4000
      });
    }
  }
};
```

### Validation Warnings
```javascript
if (!formData.email) {
  showModernAlert({
    type: 'warning',
    title: 'Missing Email',
    message: 'Please enter an email address',
    duration: 3000
  });
  return;
}

if (formData.password !== formData.confirmPassword) {
  showModernAlert({
    type: 'warning',
    title: 'Password Mismatch',
    message: 'Passwords do not match',
    duration: 3000
  });
  return;
}
```

## Options Reference

### showModernAlert()
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| type | string | 'info' | 'success', 'error', 'warning', 'info' |
| title | string | '' | Alert title |
| message | string | '' | Alert message |
| duration | number | 3000 | Auto-dismiss time in ms (0 = persistent) |
| showConfetti | boolean | false | Show confetti animation (success only) |

### showConfirmDialog()
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| title | string | 'Confirm' | Dialog title |
| message | string | 'Are you sure?' | Dialog message |
| confirmText | string | 'Confirm' | Confirm button text |
| cancelText | string | 'Cancel' | Cancel button text |
| type | string | 'warning' | 'warning', 'danger', 'info' |
| showIcon | boolean | true | Show icon in dialog |

## Replacing Old alert() Calls

### Before (Old)
```javascript
alert('User created successfully!');
```

### After (New)
```javascript
showModernAlert({
  type: 'success',
  title: 'Success!',
  message: 'User created successfully!',
  duration: 3000
});
```

### Before (Old Confirm)
```javascript
if (window.confirm('Are you sure?')) {
  deleteItem();
}
```

### After (New Confirm)
```javascript
const confirmed = await showConfirmDialog({
  title: 'Confirm Delete',
  message: 'Are you sure?',
  confirmText: 'Delete',
  cancelText: 'Cancel',
  type: 'danger'
});

if (confirmed) {
  deleteItem();
}
```

## Tips

1. **Use confetti sparingly** - Only for major success actions (create, complete)
2. **Keep messages short** - One line is best
3. **Use appropriate types** - Success for completions, warning for validations, error for failures
4. **Set duration appropriately** - 3s for success, 4s for errors
5. **Don't stack too many** - Wait for previous alerts to dismiss

## Browser Support

✅ Chrome 90+  
✅ Firefox 88+  
✅ Safari 14+  
✅ Edge 90+  

## Mobile Responsive

The alert system automatically adjusts for mobile devices:
- Full width on screens < 640px
- Buttons stack vertically on mobile
- Touch-friendly button sizes
