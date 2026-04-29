import UIKit

final class OfflineView: UIView {
    var onRetry: (() -> Void)?

    private let stack = UIStackView()
    private let iconLabel = UILabel()
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func setup() {
        backgroundColor = UIColor(red: 0x0b/255, green: 0x0b/255, blue: 0x0c/255, alpha: 1)

        iconLabel.text = "✦"
        iconLabel.font = .systemFont(ofSize: 56, weight: .light)
        iconLabel.textColor = UIColor(red: 1, green: 0.78, blue: 0.27, alpha: 1)
        iconLabel.textAlignment = .center

        titleLabel.text = "You're offline"
        titleLabel.font = .systemFont(ofSize: 22, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center

        messageLabel.text = "Check your internet connection and try again."
        messageLabel.font = .systemFont(ofSize: 15)
        messageLabel.textColor = UIColor(white: 0.75, alpha: 1)
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0

        retryButton.setTitle("Retry", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        retryButton.setTitleColor(.black, for: .normal)
        retryButton.backgroundColor = UIColor(red: 1, green: 0.78, blue: 0.27, alpha: 1)
        retryButton.layer.cornerRadius = 22
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 28, bottom: 10, right: 28)
        retryButton.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(iconLabel)
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(messageLabel)
        stack.setCustomSpacing(22, after: messageLabel)
        stack.addArrangedSubview(retryButton)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -32)
        ])
    }

    @objc private func retryTapped() { onRetry?() }
}
