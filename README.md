# JS/TS nREPL
Forcefully intergrating JS into the foreign realm of Clojure tooling. Both of them can evaluate code at runtime, so why not?

This is an implementation of an [nREPL](https://nrepl.org)
[server](https://nrepl.org/nrepl/1.0/building_servers.html) wrapping
[`ts-node`](https://typestrong.org/ts-node/api/).

## Example usage with CIDER
``` emacs-lisp
(require 'typescript-mode)
(require 'expand-region)
(require 'js2-mode)

(defmacro my/def-ts-eval (name &rest body)
  "Create a function evaluating Typescript code in CIDER.

NAME will appear at the created function's name
BODY is a snippet that marks a region of code to be evaluated in CIDER"
  (declare (indent defun))
  `(defun ,(intern (format "my/typescript-eval-%s" name)) ()
     (interactive)
     (save-mark-and-excursion
       (progn
         ,@body
         (call-interactively #'cider-eval-region)))))

(my/def-ts-eval defun (er/mark-js-function))
(my/def-ts-eval symbol (er/mark-symbol))
(my/def-ts-eval region (ignore))
(my/def-ts-eval line
  (beginning-of-line)
  (set-mark (point))
  (end-of-line))

(bind-key "C-c C-e" #'my/typescript-eval-defun typescript-mode-map)
(bind-key "C-c C-e" #'my/typescript-eval-symbol typescript-mode-map)
(bind-key "C-c C-r" #'my/typescript-eval-region typescript-mode-map)
(bind-key "C-c C-l" #'my/typescript-eval-line typescript-mode-map)
```
